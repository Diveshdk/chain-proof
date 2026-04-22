export interface Copyright {
  creator: string;
  contentHash: string;
  metadataURI: string;
  timestamp: number;
  isActive: boolean;
}

export interface RoyaltyInfo {
  creator: string;
  royaltyPercentage: number;
  totalEarned: string;
}

export interface Dispute {
  contentId: string;
  claimant: string;
  original: string;
  evidence: string;
  votesFor: number;
  votesAgainst: number;
  createdAt: number;
  status: DisputeStatus;
}

export enum DisputeStatus {
  Pending = 0,
  Resolved = 1,
  Rejected = 2,
}

export interface ContentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
  perceptualHash: string;
  ipfsHash: string;
  uploadedAt: string;
  creator?: string;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface UploadResponse {
  success: boolean;
  data: {
    ipfsHash: string;
    metadataHash: string;
    contentHash: string;
    perceptualHash: string;
    fileName: string;
  };
}

export interface SimilarContent {
  contentId: string;
  similarity: number;
}

export interface ContractAddresses {
  copyrightRegistry: string;
  royaltyManager: string;
  disputeDAO: string;
  governanceToken: string;
  contentNFT: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  contracts: ContractAddresses;
}
