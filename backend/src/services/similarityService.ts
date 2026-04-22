import { hashService } from './hashService';
import { supabase } from '../config/supabase';

export interface MatchResult {
  contentId: string;
  matchedFrames: number;
  totalNewFrames: number;
  similarityScore: number;  // 0-100
  matchedHashes: Array<{
    newHash: string;
    dbHash: string;
    distance: number;
    frameIndex: number;
  }>;
}

export class SimilarityService {

  private readonly HAMMING_THRESHOLD = parseInt(process.env.PHASH_HAMMING_THRESHOLD || '10', 10);
  private readonly FRAME_THRESHOLD = parseInt(process.env.SIMILARITY_FRAME_THRESHOLD || '20', 10);

  // ─── Hamming distance on hex pHash strings ──────────────
  calculateHammingDistance(hash1: string, hash2: string): number {
    return hashService.hammingDistance(hash1, hash2);
  }

  // ─── Single hash similarity % ────────────────────────────
  calculateSimilarity(hash1: string, hash2: string): number {
    const distance = this.calculateHammingDistance(hash1, hash2);
    const maxBits = Math.max(hash1.length, hash2.length) * 4; // hex → bits
    const similarity = ((maxBits - distance) / maxBits) * 100;
    return Math.round(similarity * 100) / 100;
  }

  // ─── Compare new hashes against ALL stored hashes ────────
  /**
   * Updated to handle regional tiling (up to 17 hashes per image/frame).
   * Calculates similarity by checking if ANY region matches above the threshold.
   */
  async compareWithDatabase(newHashes: string[]): Promise<MatchResult[]> {
    if (newHashes.length === 0) return [];

    // Build unique prefix set (first 2 hex chars = 8 bits)
    const prefixes = [...new Set(newHashes.map(h => h.substring(0, 2)))];
    
    // Fetch candidate hashes from DB using prefix filter
    const orFilter = prefixes.map(p => `hash_value.ilike.${p}%`).join(',');
    
    const { data: candidates, error } = await supabase
      .from('content_hashes')
      .select('content_id, hash_value, frame_index')
      .or(orFilter);

    if (error) {
      console.error('Supabase query error:', error);
      return this.compareWithAllHashes(newHashes);
    }

    if (!candidates || candidates.length === 0) return [];

    // Group candidates by content_id
    const byContent = new Map<string, Array<{ hash_value: string; frame_index: number }>>();
    for (const row of candidates) {
      const existing = byContent.get(row.content_id) || [];
      existing.push({ hash_value: row.hash_value, frame_index: row.frame_index });
      byContent.set(row.content_id, existing);
    }

    const results: MatchResult[] = [];

    for (const [contentId, dbHashes] of byContent.entries()) {
      const matchedHashes: MatchResult['matchedHashes'] = [];

      // For regional tiling, we check if any of the new hashes match any of the DB hashes
      // This increases sensitivity to partial reuse
      for (const newHash of newHashes) {
        for (const dbEntry of dbHashes) {
          const distance = this.calculateHammingDistance(newHash, dbEntry.hash_value);
          if (distance <= this.HAMMING_THRESHOLD) {
            matchedHashes.push({
              newHash,
              dbHash: dbEntry.hash_value,
              distance,
              frameIndex: dbEntry.frame_index,
            });
            break; 
          }
        }
      }

      // Calculate score based on the highest match intensity
      const totalNewHashes = newHashes.length;
      const matchedCount = matchedHashes.length;
      
      // If we are using 16-tile grid, even a few matches indicate high reuse of parts
      const similarityScore = totalNewHashes > 0
        ? Math.round((matchedCount / totalNewHashes) * 100 * 100) / 100
        : 0;

      if (similarityScore > 0) {
        results.push({ contentId, matchedFrames: matchedCount, totalNewFrames: totalNewHashes, similarityScore, matchedHashes });
      }
    }

    return results.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  // ─── Fallback: fetch all hashes (no prefix filter) ───────
  private async compareWithAllHashes(newHashes: string[]): Promise<MatchResult[]> {
    const { data: allHashes } = await supabase
      .from('content_hashes')
      .select('content_id, hash_value, frame_index');

    if (!allHashes || allHashes.length === 0) return [];

    const byContent = new Map<string, Array<{ hash_value: string; frame_index: number }>>();
    for (const row of allHashes) {
      const existing = byContent.get(row.content_id) || [];
      existing.push({ hash_value: row.hash_value, frame_index: row.frame_index });
      byContent.set(row.content_id, existing);
    }

    const results: MatchResult[] = [];

    for (const [contentId, dbHashes] of byContent.entries()) {
      const matchedHashes: MatchResult['matchedHashes'] = [];
      for (const newHash of newHashes) {
        for (const dbEntry of dbHashes) {
          const distance = this.calculateHammingDistance(newHash, dbEntry.hash_value);
          if (distance <= this.HAMMING_THRESHOLD) {
            matchedHashes.push({
              newHash,
              dbHash: dbEntry.hash_value,
              distance,
              frameIndex: dbEntry.frame_index,
            });
            break;
          }
        }
      }
      const similarityScore = newHashes.length > 0
        ? Math.round((matchedHashes.length / newHashes.length) * 100 * 100) / 100
        : 0;
      if (similarityScore > 0) {
        results.push({
          contentId,
          matchedFrames: matchedHashes.length,
          totalNewFrames: newHashes.length,
          similarityScore,
          matchedHashes,
        });
      }
    }

    return results.sort((a, b) => b.similarityScore - a.similarityScore);
  }


  // ─── Is content infringing? ──────────────────────────────
  isInfringing(similarityScore: number): boolean {
    return similarityScore >= this.FRAME_THRESHOLD;
  }
}

export const similarityService = new SimilarityService();
