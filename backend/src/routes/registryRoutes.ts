import { Router } from 'express';
import { registryController } from '../controllers/registryController';

const router = Router();

// Global stats
router.get('/stats', registryController.getStats.bind(registryController));

// All registered content
router.get('/', registryController.getAllContent.bind(registryController));

// Single content with hashes
router.get('/:contentId', registryController.getContentById.bind(registryController));

export default router;
