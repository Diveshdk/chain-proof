import { Router } from 'express';
import multer from 'multer';
import { disputeController } from '../controllers/disputeController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// File-upload based infringement detection
router.post('/detect', upload.single('file'), disputeController.detectInfringement.bind(disputeController));

// Hash-string based check (legacy)
router.post('/hash-check', disputeController.checkByHash.bind(disputeController));

// Copyright claims
router.get('/claims', disputeController.getClaims.bind(disputeController));
router.patch('/claims/:id/status', disputeController.updateClaimStatus.bind(disputeController));

export default router;
