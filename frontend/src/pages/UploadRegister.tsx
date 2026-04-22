import React, { useState, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { uploadFile, rollbackContent, updateClaimStatus } from '../services/api';
import type { UploadResult } from '../services/api';
import { contractService } from '../services/contractService';
import { useNavigate } from 'react-router-dom';

const PIPELINE_STEPS = [
  {
    id: 1,
    icon: '🎞️',
    label: 'Content Preprocessing',
    desc: 'Extracting frames (video: 1fps) or decoding image pixels',
  },
  {
    id: 2,
    icon: '🔢',
    label: 'pHash Generation (64-bit DCT)',
    desc: 'Generating perceptual fingerprints via Discrete Cosine Transform',
  },
  {
    id: 3,
    icon: '🌐',
    label: 'IPFS Storage via Pinata',
    desc: 'Uploading file + hash metadata JSON to decentralised storage',
  },
  {
    id: 4,
    icon: '⛓️',
    label: 'Blockchain Registration',
    desc: 'Anchoring ownership on Base network (MetaMask Required)',
  },
];

const UploadRegister: React.FC = () => {
  const { user } = useWallet();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [royaltyFee, setRoyaltyFee] = useState(5);
  const [loading, setLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pendingResult, setPendingResult] = useState<UploadResult | null>(null);
  const [showCopyrightWarning, setShowCopyrightWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File) => {
    setFile(f);
    setResult(null);
    setPendingResult(null);
    setShowCopyrightWarning(false);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowCopyrightWarning(false);
    setPipelineStage(1);

    try {
      setPipelineStage(2);
      const uploadPromise = uploadFile(file, user.walletAddress, royaltyFee);
      await new Promise(r => setTimeout(r, 1000));
      setPipelineStage(3);

      const [data] = await Promise.all([
        uploadPromise,
        new Promise(r => setTimeout(r, 1500)),
      ]);

      if (!data.isOriginal) {
        setPendingResult(data);
        setShowCopyrightWarning(true);
        setLoading(false);
        setPipelineStage(0);
        return;
      }

      await finalizeRegistration(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Upload failed. Please check your connection.');
      setLoading(false);
      setPipelineStage(0);
    }
  };

  const finalizeRegistration = async (data: UploadResult, parentCid?: string) => {
    setPipelineStage(4);
    try {
      let txResult;
      if (parentCid) {
        // Agreement flow
        txResult = await contractService.registerWithAgreement(
          data.ipfsHash,
          data.metadataHash,
          data.contentHash,
          royaltyFee,
          parentCid
        );
        // Update claim status in backend
        // We need the claim ID. The backend currently doesn't return the claim ID in upload result, 
        // but we can query it or just update by content id. 
        // Actually, let's just mark it as confirmed on-chain and in DB.
        // I'll add a helper in backend or just use a generic update.
      } else {
        // Standard flow
        txResult = await contractService.registerCopyright(
          data.ipfsHash,
          data.metadataHash,
          data.contentHash,
          royaltyFee
        );
      }

      setResult({ ...data, txHash: txResult.transactionHash, explorerUrl: txResult.explorerUrl } as any);
      setShowCopyrightWarning(false);
    } catch (err: any) {
      console.error('Blockchain Registration Failed:', err);
      if (data.id) await rollbackContent(data.id);
      setError(`Blockchain registration failed. Action rolled back. Error: ${err.message}`);
    } finally {
      setLoading(false);
      setPipelineStage(0);
    }
  };

  const handleAgreeToRoyalties = async () => {
    if (!pendingResult || !pendingResult.matchedIpfsCid) return;
    setLoading(true);
    await finalizeRegistration(pendingResult, pendingResult.matchedIpfsCid);
  };

  const handleDeleteInfringing = async () => {
    if (!pendingResult) return;
    setLoading(true);
    try {
      await rollbackContent(pendingResult.id);
      setFile(null);
      setPendingResult(null);
      setShowCopyrightWarning(false);
      setError('Content deleted successfully.');
    } catch (err: any) {
      setError('Failed to delete content.');
    } finally {
      setLoading(false);
    }
  };

  const isVideo = file?.type.startsWith('video/');

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '40px' }}>
        <h1>Register New Content</h1>
        <p className="subtitle">
          Secure your ownership with perceptual hashing (pHash) on the blockchain and set your royalty terms.
        </p>
      </header>

      <div className="grid-2">
        {/* ── Left: Upload form ────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="glass-card">
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>1. Upload Content</h2>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-bright)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {file ? (isVideo ? '🎬' : '🖼️') : '📤'}
              </div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {file ? file.name : 'Click to select or drag and drop'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Supports Image & Video (Max 500MB)
              </div>
              {file && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--primary)', fontFamily: 'JetBrains Mono' }}>
                  {isVideo ? `🎞️ Video — ${(file.size / 1024 / 1024).toFixed(1)} MB` : `🖼️ Image — ${(file.size / 1024).toFixed(0)} KB`}
                </div>
              )}
              <input
                type="file"
                ref={fileRef}
                accept="image/*,video/*"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className="glass-card">
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>2. Royalty Configuration</h2>
            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '8px' }}>
                Creator Royalty Fee (%)
              </label>
              <input
                type="range" min="0" max="25" step="0.5"
                value={royaltyFee}
                onChange={(e) => setRoyaltyFee(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{royaltyFee}%</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Typical: 5–10%</span>
              </div>
            </div>
          </div>

          <button
            className="btn-premium btn-primary"
            style={{ width: '100%' }}
            disabled={!file || loading || !user}
            onClick={handleUpload}
          >
            {loading ? 'Executing pHash Pipeline...' : 'Register to Blockchain'}
          </button>

          {error && (
            <div className="badge-warning" style={{ padding: '16px', borderRadius: '12px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* ── Right: Pipeline status ───────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Verification & Processing Status</h2>

          {pipelineStage > 0 ? (
            <div className="animate-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {PIPELINE_STEPS.map((step) => {
                  const isActive = pipelineStage === step.id;
                  const isCompleted = pipelineStage > step.id;

                  return (
                    <div
                      key={step.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '14px',
                        borderRadius: '12px',
                        background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                        border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                        opacity: isActive || isCompleted ? 1 : 0.35,
                        transform: isActive || isCompleted ? 'translateX(0)' : 'translateX(-8px)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isCompleted ? 'var(--primary)' : isActive ? 'var(--secondary)' : 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        color: 'white',
                        fontSize: isCompleted ? '18px' : '14px',
                        boxShadow: isActive ? '0 0 15px var(--secondary-glow)' : isCompleted ? '0 0 10px var(--primary-glow)' : 'none',
                        transition: 'all 0.3s ease',
                        flexShrink: 0,
                      }}>
                        {isCompleted ? '✓' : step.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '600',
                          color: isActive ? 'var(--secondary)' : isCompleted ? 'var(--primary)' : 'var(--text-main)',
                          marginBottom: '2px',
                          fontSize: '14px',
                        }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {step.desc}
                        </div>
                      </div>
                      {isActive && (
                        <div style={{
                          width: '18px', height: '18px',
                          border: '2px solid rgba(99,102,241,0.3)',
                          borderTopColor: 'var(--secondary)',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          flexShrink: 0,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : showCopyrightWarning && pendingResult ? (
            <div className="animate-fade">
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', color: '#f59e0b' }}>⚠️</div>
                <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Copyright Warning</h3>
                <span className="badge-premium badge-warning">
                  {pendingResult.similarityScore?.toFixed(1)}% Match Detected
                </span>
              </div>

              <div style={{
                background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.2)',
                padding: '20px',
                borderRadius: '16px',
                marginBottom: '24px',
              }}>
                <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
                  Our pHash pipeline detected that this content is significantly similar to an existing work on the blockchain. 
                  To proceed, you must agree to the original creator's royalty terms or remove the content.
                </p>
                <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="stat-label">Original Content Owner</div>
                  <div style={{ fontSize: '13px', fontFamily: 'JetBrains Mono', color: 'var(--primary)' }}>
                    {pendingResult.existingPost?.owner || 'Unknown Address'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleAgreeToRoyalties}
                  disabled={loading}
                  className="btn-premium btn-primary"
                  style={{ width: '100%' }}
                >
                  {loading ? 'Processing Agreement...' : 'Agree to Pay Royalties'}
                </button>
                <button
                  onClick={handleDeleteInfringing}
                  disabled={loading}
                  className="btn-premium"
                  style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                >
                  Delete Infringing Content
                </button>
              </div>
              
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
                Choosing "Agree" will record a royalty agreement on the Base network.
              </p>
            </div>
          ) : result ? (
            <div className="animate-fade">
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', color: result.isOriginal ? 'var(--primary)' : '#f59e0b' }}>
                  {result.isOriginal ? '🛡️' : '⚠️'}
                </div>
                <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>
                  {result.isOriginal ? 'Original Content Verified' : 'Similar Content Found'}
                </h3>
                <span className={`badge-premium ${result.isOriginal ? 'badge-original' : 'badge-warning'}`}>
                  {result.isOriginal ? 'Blockchain Registered' : `${result.similarityScore?.toFixed(1)}% Match Detected`}
                </span>
              </div>

              {!result.isOriginal && result.existingPost && (
                <div style={{
                  background: 'rgba(245,158,11,0.05)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontSize: '14px',
                }}>
                  Similar content exists. Original owner:{' '}
                  <strong>{result.existingPost.owner.substring(0, 10)}...</strong>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="stat-box" style={{ padding: '16px' }}>
                  <div className="stat-label">pHash Fingerprints Generated</div>
                  <div style={{ fontWeight: '700', color: 'var(--primary)' }}>
                    {result.pHashCount} hash{result.pHashCount !== 1 ? 'es' : ''} ({result.fileType})
                  </div>
                </div>
                <div className="stat-box" style={{ padding: '16px' }}>
                  <div className="stat-label">IPFS Content CID</div>
                  <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', overflowWrap: 'break-word' }}>
                    {result.ipfsHash}
                  </div>
                </div>
                <div className="stat-box" style={{ padding: '16px' }}>
                  <div className="stat-label">SHA-256 Root Hash</div>
                  <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', overflowWrap: 'break-word', color: 'var(--primary)' }}>
                    {result.contentHash}
                  </div>
                </div>
                
                {(result as any).txHash && (
                  <div className="stat-box" style={{ padding: '16px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div className="stat-label" style={{ color: '#10b981' }}>Blockchain Transaction</div>
                    <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', overflowWrap: 'break-word', marginBottom: '8px' }}>
                      {(result as any).txHash}
                    </div>
                    <a 
                      href={(result as any).explorerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'underline' }}
                    >
                      View on BaseScan Explorer ↗
                    </a>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '24px' }}>
                <button
                  onClick={() => navigate('/profile')}
                  className="btn-premium btn-secondary"
                  style={{ width: '100%' }}
                >
                  View in My Profile
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '64px', opacity: 0.15, marginBottom: '16px' }}>🔐</div>
              <p>Upload a file to begin the pHash pipeline</p>
              <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-dim)' }}>
                Images → 1 fingerprint • Videos → 1 per second
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default UploadRegister;
