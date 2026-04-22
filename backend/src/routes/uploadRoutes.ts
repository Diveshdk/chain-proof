import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/uploadController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// File upload + pHash registration
router.post('/file', upload.single('file'), uploadController.uploadFile.bind(uploadController));

// Detect similarity only (no DB write)
router.post('/detect', upload.single('file'), uploadController.detectSimilarity.bind(uploadController));

// Listings
router.get('/all', uploadController.getAllPosts);
router.get('/user/:address', uploadController.getUserPosts);
router.get('/post/:id', uploadController.getContentById);
router.delete('/post/:id', uploadController.deleteContent);
router.get('/:hash', uploadController.getFile);

// Metadata
router.post('/metadata', uploadController.uploadMetadata.bind(uploadController));


export default router;
