import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'copyright-protocol-secret-key-change-in-production';

export class AuthController {

  async getNonce(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      if (!address) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      const walletAddress = address.toLowerCase();
      const nonce = crypto.randomBytes(16).toString('hex');

      await UserModel.upsert(walletAddress, nonce);
      logger.info(`Nonce issued for: ${walletAddress}`);

      res.status(200).json({ nonce });
    } catch (error: any) {
      logger.error('Get nonce error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async verifySignature(req: Request, res: Response): Promise<void> {
    try {
      const { address, signature } = req.body;
      if (!address || !signature) {
        res.status(400).json({ error: 'Address and signature are required' });
        return;
      }

      const walletAddress = address.toLowerCase();
      const user = await UserModel.findByAddress(walletAddress);

      if (!user) {
        res.status(404).json({ error: 'User not found. Please request a nonce first.' });
        return;
      }

      const msg = `Welcome to Copyright Protocol!\n\nPlease sign this message to authenticate.\n\nNonce: ${user.nonce}`;
      const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
      const recoveredAddress = recoverPersonalSignature({ data: msgBufferHex, signature });

      if (recoveredAddress.toLowerCase() !== walletAddress) {
        res.status(401).json({ error: 'Signature verification failed' });
        return;
      }

      // Rotate nonce to prevent replay attacks
      await UserModel.updateNonce(walletAddress, crypto.randomBytes(16).toString('hex'));

      const token = jwt.sign({ walletAddress }, JWT_SECRET, { expiresIn: '24h' });

      res.status(200).json({
        success: true,
        token,
        user: {
          walletAddress: user.wallet_address,
          username: user.username || null,
          displayName: user.display_name || null,
        },
      });
    } catch (error: any) {
      logger.error('Verify signature error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
