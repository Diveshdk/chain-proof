import { Request, Response } from 'express';
import { hashService } from '../services/hashService';
import { videoService } from '../services/videoService';
import { similarityService } from '../services/similarityService';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

function detectFileType(mimeType: string): 'image' | 'video' {
  if (VIDEO_MIME_TYPES.includes(mimeType)) return 'video';
  return 'image'; // default to image
}

export class DisputeController {

  /**
   * POST /api/dispute/detect
   * Upload a file → pHash it → compare with DB → return infringement report
   */
  async detectInfringement(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided for analysis' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const fileType = detectFileType(mimeType);

      logger.info(`Dispute detection started: ${fileName} (${fileType})`);

      // Generate pHashes
      const pHashes: string[] = [];

      if (fileType === 'image') {
        const hashes = await hashService.generateRegionalHashes(fileBuffer);
        pHashes.push(...hashes);
      } else {
        const frames = await videoService.extractFrames(fileBuffer, fileName);
        for (const frame of frames) {
          const hash = await hashService.generatePHash(frame.buffer);
          pHashes.push(hash);
        }
        if (pHashes.length === 0) {
          const hashes = await hashService.generateRegionalHashes(fileBuffer.slice(0, 5000));
          pHashes.push(...hashes);
        }
      }

      logger.info(`Generated ${pHashes.length} pHashes for dispute analysis`);

      // Compare with database
      const matches = await similarityService.compareWithDatabase(pHashes);

      // Enrich with content metadata from Supabase
      const enrichedMatches = await Promise.all(
        matches.map(async match => {
          const { data: content } = await supabase
            .from('content')
            .select('id, user_id, ipfs_cid, file_name, file_type, royalty_fee, created_at')
            .eq('id', match.contentId)
            .single();

          return {
            contentId: match.contentId,
            similarityScore: match.similarityScore,
            matchedFrames: match.matchedFrames,
            totalFrames: match.totalNewFrames,
            isInfringing: similarityService.isInfringing(match.similarityScore),
            content: content
              ? {
                  id: content.id,
                  owner: content.user_id,
                  fileName: content.file_name,
                  fileType: content.file_type,
                  ipfsCid: content.ipfs_cid,
                  royaltyFee: content.royalty_fee,
                  createdAt: content.created_at,
                }
              : null,
          };
        })
      );

      const topMatch = enrichedMatches[0];
      const overallSimilarity = topMatch?.similarityScore || 0;
      const isInfringing = topMatch?.isInfringing || false;

      // If infringing, log to copyright_claims table
      if (isInfringing && topMatch) {
        await supabase.from('copyright_claims').insert({
          matched_content_id: topMatch.contentId,
          similarity_score: overallSimilarity,
          matched_frames: topMatch.matchedFrames,
          total_frames: topMatch.totalFrames,
          status: 'pending',
        });
        logger.warn(`Infringement detected! Similarity: ${overallSimilarity}% with content ${topMatch.contentId}`);
      }

      res.status(200).json({
        success: true,
        data: {
          fileName,
          fileType,
          pHashCount: pHashes.length,
          overallSimilarity,
          isInfringing,
          infringementThreshold: parseInt(process.env.SIMILARITY_FRAME_THRESHOLD || '20', 10),
          verdict: isInfringing ? 'POTENTIAL_COPYRIGHT_INFRINGEMENT' : 'NO_INFRINGEMENT_DETECTED',
          matches: enrichedMatches,
          totalMatchesFound: enrichedMatches.filter(m => m.similarityScore > 0).length,
        },
      });

    } catch (error: any) {
      logger.error('Dispute detection error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/dispute/hash-check
   * Legacy: check by providing hash strings directly (no file upload)
   */
  async checkByHash(req: Request, res: Response): Promise<void> {
    try {
      const { hashes, threshold } = req.body;

      if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
        res.status(400).json({ error: 'Provide an array of pHash strings in "hashes" field' });
        return;
      }

      const matches = await similarityService.compareWithDatabase(hashes);

      res.status(200).json({
        success: true,
        data: {
          matches: matches.map(m => ({
            contentId: m.contentId,
            similarityScore: m.similarityScore,
            matchedFrames: m.matchedFrames,
            totalFrames: m.totalNewFrames,
          })),
          totalMatchesFound: matches.length,
        },
      });
    } catch (error: any) {
      logger.error('Hash check error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/dispute/claims
   * List all logged copyright claims
   */
  async getClaims(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('copyright_claims')
        .select(`
          *,
          matched_content:matched_content_id ( id, user_id, file_name, ipfs_cid )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/dispute/claims/:id/status
   * Update claim status (confirm / dismiss)
   */
  async updateClaimStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'confirmed', 'dismissed'].includes(status)) {
        res.status(400).json({ error: 'status must be one of: pending, confirmed, dismissed' });
        return;
      }

      const { error } = await supabase
        .from('copyright_claims')
        .update({ status })
        .eq('id', id);

      if (error) throw new Error(error.message);

      res.status(200).json({ success: true, message: `Claim ${id} updated to ${status}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const disputeController = new DisputeController();
