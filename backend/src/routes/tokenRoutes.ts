import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Minimal ABI — only what we need for minting
const TOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

const CLAIM_AMOUNT = ethers.parseEther('100'); // 100 CGT

/**
 * POST /api/claim-tokens
 * Body: { address: string }
 *
 * Mints 100 CGT to the given address using the deployer wallet.
 * Idempotent — will not mint again if balance > 0.
 */
router.post('/', async (req: Request, res: Response) => {
  const { address } = req.body as { address?: string };

  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid or missing Ethereum address' });
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const tokenAddress = process.env.GOVERNANCE_TOKEN_ADDRESS;

  if (!privateKey || !tokenAddress) {
    return res.status(500).json({ error: 'Server misconfiguration: deployer credentials missing' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(privateKey, provider);
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

    // Check current balance — don't double-mint
    const currentBalance: bigint = await token.balanceOf(address);
    if (currentBalance > 0n) {
      return res.json({
        success: true,
        alreadyClaimed: true,
        balance: ethers.formatEther(currentBalance),
        message: 'Address already has CGT tokens',
      });
    }

    // Mint 100 CGT
    const tx = await token.mint(address, CLAIM_AMOUNT);
    await tx.wait();

    console.log(`✅ Minted 100 CGT to ${address} — tx: ${tx.hash}`);

    return res.json({
      success: true,
      txHash: tx.hash,
      amount: '100',
      recipient: address,
    });
  } catch (err: any) {
    console.error('claim-tokens error:', err);
    return res.status(500).json({ error: err.message || 'Minting failed' });
  }
});

export default router;
