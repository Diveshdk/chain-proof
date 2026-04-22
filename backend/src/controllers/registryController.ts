import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class RegistryController {

  /**
   * GET /api/registry
   * List all registered content with hash counts
   */
  async getAllContent(req: Request, res: Response): Promise<void> {
    try {
      const { data: contentList, error } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      // Get hash counts for each content
      const enriched = await Promise.all(
        (contentList || []).map(async (item) => {
          const { count } = await supabase
            .from('content_hashes')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', item.id);

          return { ...item, hashCount: count || 0 };
        })
      );

      res.status(200).json({ success: true, data: enriched });
    } catch (error: any) {
      logger.error('Registry fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/registry/:contentId
   * Get content details + all its pHashes
   */
  async getContentById(req: Request, res: Response): Promise<void> {
    try {
      const { contentId } = req.params;

      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (contentError || !content) {
        res.status(404).json({ error: 'Content not found' });
        return;
      }

      const { data: hashes, error: hashError } = await supabase
        .from('content_hashes')
        .select('*')
        .eq('content_id', contentId)
        .order('frame_index', { ascending: true });

      if (hashError) throw new Error(hashError.message);

      res.status(200).json({
        success: true,
        data: { ...content, hashes: hashes || [] },
      });
    } catch (error: any) {
      logger.error('Registry content fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/registry/stats
   * Global stats: total content, total hashes, total claims
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [contentRes, hashRes, claimRes] = await Promise.all([
        supabase.from('content').select('*', { count: 'exact', head: true }),
        supabase.from('content_hashes').select('*', { count: 'exact', head: true }),
        supabase.from('copyright_claims').select('*', { count: 'exact', head: true }),
      ]);

      const originalRes = await supabase
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('is_original', true);

      res.status(200).json({
        success: true,
        data: {
          totalContent: contentRes.count || 0,
          totalHashes: hashRes.count || 0,
          totalClaims: claimRes.count || 0,
          originalContent: originalRes.count || 0,
        },
      });
    } catch (error: any) {
      logger.error('Stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const registryController = new RegistryController();
