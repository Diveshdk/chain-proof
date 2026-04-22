import { Request, Response } from 'express';
import { pinataService } from '../services/pinataService';
import { hashService } from '../services/hashService';
import { videoService } from '../services/videoService';
import { similarityService } from '../services/similarityService';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

function detectFileType(mimeType: string): 'image' | 'video' | 'unknown' {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return 'image';
  if (VIDEO_MIME_TYPES.includes(mimeType)) return 'video';
  return 'unknown';
}

export class UploadController {

  /**
   * POST /api/upload/file
   * Full pHash pipeline:
   *   1. Detect image vs video
   *   2. Generate pHashes (per frame for video)
   *   3. Upload file to Pinata
   *   4. Upload hash metadata to Pinata
   *   5. Insert content + content_hashes into Supabase
   *   6. Return result with hash count
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { ownerAddress, royaltyFee } = req.body;
      if (!ownerAddress) {
        res.status(400).json({ error: 'Owner address (ownerAddress) is required' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileType = detectFileType(mimeType);

      // ── 1. SHA-256 for exact duplicate check ──────────────
      const sha256Hash = hashService.generateFileHash(fileBuffer);

      // ── 2. Generate pHashes ───────────────────────────────
      let pHashes: { hash: string; frameIndex: number; timestampSecond: number }[] = [];

      if (fileType === 'image') {
        const hashes = await hashService.generateRegionalHashes(fileBuffer);
        pHashes = hashes.map(h => ({ hash: h, frameIndex: 0, timestampSecond: 0 }));
        logger.info(`Image regional pHashes generated: ${hashes.length}`);
      } else if (fileType === 'video') {
        logger.info('Extracting video frames...');
        const frames = await videoService.extractFrames(fileBuffer, fileName);
        if (frames.length === 0) {
          logger.warn('No frames extracted — treating first byte slice as image fallback');
          const hashes = await hashService.generateRegionalHashes(fileBuffer.slice(0, 5000));
          pHashes = hashes.map(h => ({ hash: h, frameIndex: 0, timestampSecond: 0 }));
        } else {
          for (const frame of frames) {
            const hash = await hashService.generatePHash(frame.buffer);
            pHashes.push({ hash, frameIndex: frame.frameIndex, timestampSecond: frame.timestampSecond });
          }
          logger.info(`Video: extracted ${frames.length} frames, generated ${pHashes.length} pHashes`);
        }
        // Unknown file type or image — generate regional hashes
        const hashes = await hashService.generateRegionalHashes(fileBuffer);
        pHashes = hashes.map(h => ({ hash: h, frameIndex: 0, timestampSecond: 0 }));
      }

      // ── 3. Check similarity against existing content ──────
      const hashValues = pHashes.map(p => p.hash);
      const similarResults = await similarityService.compareWithDatabase(hashValues);
      const topMatch = similarResults[0];
      const frameThreshold = parseInt(process.env.SIMILARITY_FRAME_THRESHOLD || '20', 10);
      const isOriginal = !topMatch || topMatch.similarityScore < frameThreshold;

      // ── 4. Upload file to Pinata ──────────────────────────
      logger.info('Uploading file to Pinata...');
      const ipfsCid = await pinataService.pinFile(fileBuffer, fileName);

      // ── 5. Upload hash metadata to Pinata ─────────────────
      const hashMetadata = {
        fileName,
        fileType,
        sha256: sha256Hash,
        pHashes: pHashes.map(p => ({ hash: p.hash, frame: p.frameIndex, ts: p.timestampSecond })),
        generatedAt: new Date().toISOString(),
        ownerAddress: ownerAddress.toLowerCase(),
      };
      const metadataCid = await pinataService.pinJSON(hashMetadata, `${fileName}-phash-metadata`);

      // ── 6. Insert into Supabase: content ──────────────────
      const { data: contentRow, error: contentError } = await supabase
        .from('content')
        .insert({
          user_id: ownerAddress.toLowerCase(),
          ipfs_cid: ipfsCid,
          metadata_cid: metadataCid,
          file_name: fileName,
          file_type: fileType,
          royalty_fee: parseFloat(royaltyFee) || 0,
          is_original: isOriginal,
          merkle_root: sha256Hash,
        })
        .select()
        .single();

      if (contentError) {
        logger.error('Supabase content insert error:', contentError);
        res.status(500).json({ error: `Database error: ${contentError.message}` });
        return;
      }

      // ── 7. Batch insert content_hashes ────────────────────
      const hashRows = pHashes.map(p => ({
        content_id: contentRow.id,
        hash_value: p.hash,
        frame_index: p.frameIndex,
        timestamp_second: p.timestampSecond,
      }));

      const { error: hashError } = await supabase
        .from('content_hashes')
        .insert(hashRows);

      if (hashError) {
        logger.warn('Hash insert warning:', hashError.message);
      }

      logger.info(`Upload complete: ${fileName} | CID: ${ipfsCid} | Hashes: ${pHashes.length} | Original: ${isOriginal}`);

      // ── 8. If infringing, log to copyright_claims ─────────
      if (!isOriginal && topMatch) {
        await supabase.from('copyright_claims').insert({
          new_content_id: contentRow.id,
          matched_content_id: topMatch.contentId,
          similarity_score: topMatch.similarityScore,
          matched_frames: topMatch.matchedFrames,
          total_frames: topMatch.totalNewFrames,
          status: 'pending',
        });
        logger.warn(`Infringement logged: ${contentRow.id} matches ${topMatch.contentId}`);
      }

      // Fetch matched content IPFS CID and owner for frontend registration agreement
      let matchedIpfsCid = null;
      let matchedOwner = 'Unknown Address';
      if (!isOriginal && topMatch) {
        const { data: matchedWork } = await supabase
          .from('content')
          .select('ipfs_cid, user_id')
          .eq('id', topMatch.contentId)
          .single();
        matchedIpfsCid = matchedWork?.ipfs_cid || null;
        matchedOwner = matchedWork?.user_id || 'Unknown Address';
      }

      res.status(200).json({
        success: true,
        data: {
          id: contentRow.id,
          ipfsHash: ipfsCid,
          metadataHash: metadataCid,
          contentHash: sha256Hash,
          fileType,
          pHashCount: pHashes.length,
          isOriginal,
          similarityScore: topMatch?.similarityScore || 0,
          matchedIpfsCid, // Useful for blockchain agreement
          existingPost: topMatch && !isOriginal
            ? { owner: matchedOwner, postId: topMatch.contentId, similarityScore: topMatch.similarityScore }
            : null,
          fileName,
        },
      });

    } catch (error: any) {
      logger.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/upload/detect
   * Detect similarity without saving to DB.
   * Used by the Dispute/Similarity checker in the frontend.
   */
  async detectSimilarity(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileType = detectFileType(mimeType);

      // Generate pHashes
      let pHashes: string[] = [];

      if (fileType === 'image') {
        const hash = await hashService.generatePHash(fileBuffer);
        pHashes = [hash];
      } else if (fileType === 'video') {
        const frames = await videoService.extractFrames(fileBuffer, fileName);
        for (const frame of frames) {
          const hash = await hashService.generatePHash(frame.buffer);
          pHashes.push(hash);
        }
        if (pHashes.length === 0) {
          const hash = await hashService.generatePHash(fileBuffer.slice(0, 5000));
          pHashes = [hash];
        }
      } else {
        const hash = await hashService.generatePHash(fileBuffer);
        pHashes = [hash];
      }

      // Compare with database
      const matches = await similarityService.compareWithDatabase(pHashes);

      // Enrich matches with content metadata
      const enrichedMatches = await Promise.all(
        matches.map(async match => {
          const { data: content } = await supabase
            .from('content')
            .select('id, user_id, ipfs_cid, file_name, file_type, created_at')
            .eq('id', match.contentId)
            .single();

          return {
            contentId: match.contentId,
            similarityScore: match.similarityScore,
            matchedFrames: match.matchedFrames,
            totalFrames: match.totalNewFrames,
            isInfringing: similarityService.isInfringing(match.similarityScore),
            content: content || null,
          };
        })
      );

      const topMatch = enrichedMatches[0];
      const overallSimilarity = topMatch?.similarityScore || 0;

      res.status(200).json({
        success: true,
        data: {
          fileType,
          pHashCount: pHashes.length,
          overallSimilarity,
          isInfringing: topMatch?.isInfringing || false,
          matches: enrichedMatches,
          totalMatchesFound: enrichedMatches.length,
        },
      });

    } catch (error: any) {
      logger.error('Detect error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/upload/all
   */
  async getAllPosts(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/upload/post/:id
   */
  async getContentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/upload/post/:id
   * Rollback registration if blockchain fails
   */
  async deleteContent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, message: 'Content rolled back successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/upload/user/:address
   */
  async getUserPosts(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', address.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/upload/metadata
   */
  async uploadMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { metadata, name } = req.body;
      const ipfsHash = await pinataService.pinJSON(metadata, name || 'metadata');
      res.status(200).json({ success: true, data: { ipfsHash } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/upload/:hash
   */
  async getFile(req: Request, res: Response): Promise<void> {
    try {
      const { hash } = req.params;
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
      res.status(200).json({ success: true, data: { gatewayUrl } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const uploadController = new UploadController();
