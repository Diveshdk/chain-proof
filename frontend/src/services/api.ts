import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: BASE_URL, timeout: 120000 }); // 2min for video

// Auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ─── Types ─────────────────────────────────────────── */
export interface UploadResult {
  id: string;
  ipfsHash: string;
  metadataHash: string;
  contentHash: string;
  fileType: 'image' | 'video' | 'unknown';
  pHashCount: number;
  isOriginal: boolean;
  similarityScore: number;
  matchedIpfsCid?: string | null;
  fileName: string;
  existingPost?: {
    owner: string;
    postId: string;
    similarityScore: number;
  } | null;
}

export interface DetectResult {
  fileName: string;
  fileType: string;
  pHashCount: number;
  overallSimilarity: number;
  isInfringing: boolean;
  infringementThreshold: number;
  verdict: 'POTENTIAL_COPYRIGHT_INFRINGEMENT' | 'NO_INFRINGEMENT_DETECTED';
  totalMatchesFound: number;
  matches: DetectMatch[];
}

export interface DetectMatch {
  contentId: string;
  similarityScore: number;
  matchedFrames: number;
  totalFrames: number;
  isInfringing: boolean;
  content: {
    id: string;
    owner: string;
    fileName: string;
    fileType: string;
    ipfsCid: string;
    royaltyFee: number;
    createdAt: string;
  } | null;
}

export interface RegistryStats {
  totalContent: number;
  totalHashes: number;
  totalClaims: number;
  originalContent: number;
}

/* ─── Upload ────────────────────────────────────────── */
export const uploadFile = async (
  file: File,
  ownerAddress: string,
  royaltyFee: number = 0
): Promise<UploadResult> => {
  const form = new FormData();
  form.append('file', file);
  form.append('ownerAddress', ownerAddress);
  form.append('royaltyFee', royaltyFee.toString());
  const { data } = await api.post('/api/upload/file', form);
  return data.data;
};

/* ─── Detect Similarity ─────────────────────────────── */
export const detectSimilarity = async (file: File): Promise<DetectResult> => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/api/upload/detect', form, {
    timeout: 180000, // 3min for large videos
  });
  return data.data;
};

/* ─── Registry ──────────────────────────────────────── */
export const getUserPosts = async (address: string) => {
  const { data } = await api.get(`/api/upload/user/${address}`);
  return data.data;
};

export const getAllPosts = async () => {
  const { data } = await api.get('/api/upload/all');
  return data.data;
};

export const rollbackContent = async (id: string): Promise<void> => {
  await api.get(`/api/upload/post/${id}`); // Validation
  await api.delete(`/api/upload/post/${id}`);
};

export const getRegistryStats = async (): Promise<RegistryStats> => {
  const { data } = await api.get('/api/registry/stats');
  return data.data;
};

export const getRegistry = async () => {
  const { data } = await api.get('/api/registry');
  return data.data;
};

/* ─── Claims ────────────────────────────────────────── */
export const getCopyrightClaims = async () => {
  const { data } = await api.get('/api/dispute/claims');
  return data.data;
};

export const updateClaimStatus = async (id: string, status: 'confirmed' | 'dismissed'): Promise<void> => {
  await api.patch(`/api/dispute/claims/${id}/status`, { status });
};

/* ─── Health ────────────────────────────────────────── */
export const healthCheck = async () => {
  const { data } = await api.get('/health');
  return data;
};
