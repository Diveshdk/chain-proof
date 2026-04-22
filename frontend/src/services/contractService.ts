import { ethers } from 'ethers';
import { CONTRACT_CONFIG } from '../config/contracts';

// Multiple fallback RPCs — tried in order until one works
const SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://1rpc.io/sepolia',
  'https://rpc2.sepolia.org',
  CONTRACT_CONFIG.network.rpcUrl,
];

async function getWorkingProvider(): Promise<ethers.JsonRpcProvider> {
  for (const url of SEPOLIA_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber(); // quick liveness check
      return p;
    } catch {
      // try next
    }
  }
  // fallback — return first even if not proven working
  return new ethers.JsonRpcProvider(SEPOLIA_RPCS[0]);
}


export interface BlockchainResult {
  contentId: string;
  transactionHash: string;
  explorerUrl: string;
}

export class ContractService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract | null = null;
  private disputeDAOContract: ethers.Contract | null = null;
  private governanceTokenContract: ethers.Contract | null = null;

  private async ensureNetwork() {
    if (typeof window.ethereum === 'undefined') return;

    const targetChainId = `0x${Number(CONTRACT_CONFIG.network.chainId).toString(16)}`;
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

    if (currentChainId !== targetChainId) {
      console.log(`Wrong network detected. Switching to ${CONTRACT_CONFIG.network.name}...`);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }],
        });
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: targetChainId,
                  chainName: CONTRACT_CONFIG.network.name,
                  rpcUrls: [CONTRACT_CONFIG.network.rpcUrl],
                  blockExplorerUrls: [CONTRACT_CONFIG.network.blockExplorer],
                  nativeCurrency: {
                    name: "Sepolia Ether",
                    symbol: "ETH",
                    decimals: 18,
                  },
                },
              ],
            });
          } catch (addError) {
            console.error('Failed to add network:', addError);
          }
        }
        console.error('Failed to switch network:', switchError);
      }
    }
  }

  /**
   * Returns a read-only instance of the CopyrightRegistry contract.
   * Uses a resilient multi-RPC provider — no wallet required.
   */
  private async getReadOnlyContract(): Promise<ethers.Contract> {
    const readProvider = await getWorkingProvider();
    return new ethers.Contract(
      CONTRACT_CONFIG.address,
      CONTRACT_CONFIG.abi,
      readProvider
    );
  }

  /**
   * Returns a read-only instance of the DisputeDAO contract.
   * Uses a resilient multi-RPC provider — no wallet needed for view calls.
   */
  private async getReadOnlyDisputeDAO(): Promise<ethers.Contract> {
    const readProvider = await getWorkingProvider();
    return new ethers.Contract(
      CONTRACT_CONFIG.disputeDAO.address,
      CONTRACT_CONFIG.disputeDAO.abi,
      readProvider
    );
  }

  private async initialize() {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('No Ethereum wallet found. Please install MetaMask.');
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    await this.ensureNetwork();
    this.signer = await this.provider.getSigner();
    
    this.contract = new ethers.Contract(
      CONTRACT_CONFIG.address,
      CONTRACT_CONFIG.abi,
      this.signer
    );

    this.disputeDAOContract = new ethers.Contract(
      CONTRACT_CONFIG.disputeDAO.address,
      CONTRACT_CONFIG.disputeDAO.abi,
      this.signer
    );

    this.governanceTokenContract = new ethers.Contract(
      CONTRACT_CONFIG.governanceToken.address,
      CONTRACT_CONFIG.governanceToken.abi,
      this.signer
    );
  }

  // ─── GOVERNANCE TOKEN METHODS ─────────────────────────

  /**
   * Returns true if the user has already received tokens (balance > 0).
   * GovernanceToken has NO hasClaimed() fn — we check balanceOf instead.
   * Returns false (show button) on any error so the user can attempt to claim.
   */
  async hasClaimedTokens(): Promise<boolean> {
    try {
      await this.initialize();
      if (!this.governanceTokenContract || !this.signer) return false;
      const balance: bigint = await this.governanceTokenContract.balanceOf(this.signer.address);
      return balance > 0n;
    } catch (e) {
      console.warn('hasClaimedTokens check failed (showing button):', e);
      return false; // Show the button so user can try claiming
    }
  }

  /**
   * Claims 100 CGT tokens via the backend faucet (mints as contract owner).
   * GovernanceToken has NO public claim() — only owner can mint.
   */
  async claimTokens(): Promise<string> {
    await this.initialize();
    if (!this.signer) throw new Error('Wallet not connected');
    const address = await this.signer.getAddress();
    try {
      const res = await fetch('http://localhost:5000/api/claim-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');
      return data.txHash || 'minted';
    } catch (err: any) {
      throw new Error(err.message || 'Token claim failed. Backend may be offline.');
    }
  }

  /**
   * Register content on the Base blockchain
   */
  async registerCopyright(
    ipfsCID: string,
    metadataCID: string,
    contentHash: string,
    royaltyPercentage: number
  ): Promise<BlockchainResult> {
    await this.initialize();
    if (!this.contract) throw new Error('Contract not initialized');

    // Convert royalty percentage to basis points (5% = 500 bps)
    const royaltyBps = Math.round(royaltyPercentage * 100);

    console.log('Registering on-chain:', { ipfsCID, metadataCID, contentHash, royaltyBps });

    const tx = await this.contract.registerCopyright(
      ipfsCID,
      metadataCID,
      contentHash,
      royaltyBps
    );

    const receipt = await tx.wait();
    const explorerUrl = `${CONTRACT_CONFIG.network.blockExplorer}/tx/${tx.hash}`;

    return {
      contentId: receipt.logs[0]?.topics[1] || '0x...', 
      transactionHash: tx.hash,
      explorerUrl,
    };
  }

  /**
   * Escalate a copyright infringement to the DisputeDAO
   */
  async createDispute(
    contentId: string,
    originalOwner: string,
    evidenceLink: string
  ): Promise<BlockchainResult> {
    await this.initialize();
    if (!this.disputeDAOContract || !this.contract) throw new Error('Contracts not initialized');

    let finalizedId = contentId;

    // If the provided ID is not a valid 32-byte hex (e.g., it's a UUID or IPFS CID),
    // we must look up the real blockchain bytes32 ID using the CID.
    if (!contentId.startsWith('0x') || contentId.length !== 66) {
      console.log('ID is not hex, looking up by CID:', contentId);
      // Use a read-only provider for this lookup — it does not require a signer.
      const readOnlyRegistry = await this.getReadOnlyContract();
      try {
        finalizedId = await readOnlyRegistry.lookupByCID(contentId);
      } catch (lookupErr: any) {
        console.error('lookupByCID failed:', lookupErr);
        throw new Error(
          `Could not look up content on chain. Ensure the contract is deployed on ${CONTRACT_CONFIG.network.name} and the CID is correct.`
        );
      }
      if (!finalizedId || finalizedId === ethers.ZeroHash) {
        throw new Error('This content is not registered on the blockchain. Cannot dispute.');
      }
    }

    // The contract expects _original as an address (not a UUID string).
    // Validate it; if invalid, fall back to the caller's own address.
    let originalAddress: string;
    if (ethers.isAddress(originalOwner)) {
      originalAddress = originalOwner;
    } else {
      console.warn(`'${originalOwner}' is not a valid address. Using caller address for _original.`);
      originalAddress = await this.signer!.getAddress();
    }

    console.log('Escalating to DAO:', { finalizedId, originalAddress, evidenceLink });

    const tx = await this.disputeDAOContract.createDispute(
      finalizedId,
      originalAddress,
      evidenceLink
    );

    await tx.wait();
    const explorerUrl = `${CONTRACT_CONFIG.network.blockExplorer}/tx/${tx.hash}`;

    return {
      contentId: finalizedId,
      transactionHash: tx.hash,
      explorerUrl,
    };
  }

  /**
   * Register content with a royalty agreement for similar content
   */
  async registerWithAgreement(
    ipfsCID: string,
    metadataCID: string,
    contentHash: string,
    royaltyPercentage: number,
    parentIpfsCID: string
  ): Promise<BlockchainResult> {
    await this.initialize();
    if (!this.contract) throw new Error('Contract not initialized');

    // Lookup parent contentId by its CID
    const parentContentId = await this.contract.lookupByCID(parentIpfsCID);
    if (parentContentId === ethers.ZeroHash) {
      throw new Error('Parent content not found on blockchain');
    }

    const royaltyBps = Math.round(royaltyPercentage * 100);

    console.log('Registering with agreement:', { ipfsCID, parentIpfsCID, parentContentId });

    const tx = await this.contract.registerWithRoyaltyAgreement(
      ipfsCID,
      metadataCID,
      contentHash,
      royaltyBps,
      parentContentId
    );

    const receipt = await tx.wait();
    const explorerUrl = `${CONTRACT_CONFIG.network.blockExplorer}/tx/${tx.hash}`;

    return {
      contentId: receipt.logs[0]?.topics[1] || '0x...',
      transactionHash: tx.hash,
      explorerUrl,
    };
  }

  async isCIDRegistered(ipfsCID: string): Promise<boolean> {
    try {
      // Use a read-only provider — no wallet required for a view call.
      const readOnlyRegistry = await this.getReadOnlyContract();
      const contentId = await readOnlyRegistry.lookupByCID(ipfsCID);
      return contentId !== ethers.ZeroHash;
    } catch (e) {
      return false;
    }
  }

  async getCopyrightInfo(contentId: string) {
    await this.initialize();
    if (!this.contract) return null;
    return await this.contract.getCopyright(contentId);
  }

  // ─── DAO GOVERNANCE METHODS ───────────────────────────

  async getDisputeCount(): Promise<number> {
    const dao = await this.getReadOnlyDisputeDAO();
    const count = await dao.disputeCount();
    return Number(count);
  }

  async getDispute(id: number) {
    const dao = await this.getReadOnlyDisputeDAO();
    const d = await dao.getDispute(id);
    return {
      id,
      contentId: d.contentId,
      claimant: d.claimant,
      original: d.original,
      evidence: d.evidence,
      votesFor: d.votesFor,
      votesAgainst: d.votesAgainst,
      createdAt: Number(d.createdAt),
      status: Number(d.status), // 0=Pending, 1=Resolved, 2=Rejected
    };
  }

  async vote(disputeId: number, support: boolean): Promise<BlockchainResult> {
    await this.initialize();
    if (!this.disputeDAOContract) throw new Error('DAO Contract not initialized');

    const tx = await this.disputeDAOContract.vote(disputeId, support);
    await tx.wait();

    return {
      contentId: disputeId.toString(),
      transactionHash: tx.hash,
      explorerUrl: `${CONTRACT_CONFIG.network.blockExplorer}/tx/${tx.hash}`,
    };
  }

  async resolveDispute(disputeId: number): Promise<BlockchainResult> {
    await this.initialize();
    if (!this.disputeDAOContract) throw new Error('DAO Contract not initialized');

    const tx = await this.disputeDAOContract.resolveDispute(disputeId);
    await tx.wait();

    return {
      contentId: disputeId.toString(),
      transactionHash: tx.hash,
      explorerUrl: `${CONTRACT_CONFIG.network.blockExplorer}/tx/${tx.hash}`,
    };
  }
}

export const contractService = new ContractService();
