import React, { useState, useRef } from 'react';
import { detectSimilarity } from '../services/api';
import type { DetectResult, DetectMatch } from '../services/api';
import { contractService } from '../services/contractService';

const DisputeEvidence: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleEscalate = async (match: DetectMatch) => {
    if (!match.content) return;
    setLoading(true);
    setError(null);
    try {
      const txResult = await contractService.createDispute(
        match.contentId,
        match.content.owner,
        `https://gateway.pinata.cloud/ipfs/${match.content.ipfsCid}`
      );
      
      // Update result state to show tx info for this match
      if (result) {
        const newMatches = result.matches.map(m => {
          if (m.contentId === match.contentId) {
            return { ...m, disputeTx: txResult.transactionHash, explorerUrl: txResult.explorerUrl };
          }
          return m;
        });
        setResult({ ...result, matches: newMatches });
      }
    } catch (err: any) {
      setError(`Escalation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await detectSimilarity(file);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Analysis failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 80) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#10b981';
  };

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '40px' }}>
        <h1>Dispute Center & Similarity Analysis</h1>
        <p className="subtitle">
          Upload any image or video to scan for copyright matches using 64-bit perceptual hashing (pHash).
          The system compares your content against the global registry using Hamming distance.
        </p>
      </header>

      <div className="grid-2">
        {/* ── Left: Upload panel ───────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card">
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Upload Content for Analysis</h2>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
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
                {file ? '🔬' : '📂'}
              </div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {file ? file.name : 'Drop image/video here or click to select'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Supports JPEG, PNG, MP4, WebM, MOV (up to 500MB)
              </div>
              {file && (
                <div style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: 'var(--primary)',
                  fontFamily: 'JetBrains Mono',
                }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB — {file.type}
                </div>
              )}
              <input type="file" ref={fileRef} style={{ display: 'none' }}
                accept="image/*,video/*"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Info box */}
          <div className="glass-card" style={{ background: 'rgba(99,102,241,0.03)', border: '1px solid var(--secondary-glow)' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--secondary)' }}>⚡ How pHash Detection Works</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.7' }}>
              <div>1. Content is resized to 32×32 grayscale</div>
              <div>2. 2D Discrete Cosine Transform (DCT) extracts visual frequencies</div>
              <div>3. Top 8×8 DCT block → 64-bit binary fingerprint</div>
              <div>4. Hamming distance ≤ 10 bits = perceptual match</div>
              <div>5. ≥ 20% frame matches → flagged as infringement</div>
            </div>
          </div>

          <button
            className="btn-premium btn-primary"
            style={{ width: '100%' }}
            disabled={!file || loading}
            onClick={handleScan}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  Running Forensic pHash Scan...
                </span>
              : '🔍 Run Forensic Scan'
            }
          </button>

          {error && (
            <div className="badge-warning" style={{ padding: '16px', borderRadius: '12px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* ── Right: Results panel ─────────────────────── */}
        <div className="glass-card">
          <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Scan Results & Evidence</h2>

          {result ? (
            <div className="animate-fade">
              {/* Verdict banner */}
              <div style={{
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                background: result.isInfringing ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                border: `1px solid ${result.isInfringing ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                textAlign: 'center',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>
                  {result.isInfringing ? '🚨' : '✅'}
                </div>
                <div style={{ fontWeight: '800', fontSize: '20px', marginBottom: '4px' }}>
                  {result.isInfringing ? 'Potential Copyright Infringement' : 'No Infringement Detected'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {result.pHashCount} pHash{result.pHashCount !== 1 ? 'es' : ''} generated • {result.totalMatchesFound} match{result.totalMatchesFound !== 1 ? 'es' : ''} found
                </div>
              </div>

              {/* Overall similarity gauge */}
              {result.overallSimilarity > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Overall Similarity</span>
                    <span style={{ fontWeight: '700', color: getSimilarityColor(result.overallSimilarity) }}>
                      {result.overallSimilarity.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(result.overallSimilarity, 100)}%`,
                      background: getSimilarityColor(result.overallSimilarity),
                      borderRadius: '100px',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Threshold: {result.infringementThreshold}%</span>
                    <span>{result.isInfringing ? '⚠️ Above threshold' : '✓ Below threshold'}</span>
                  </div>
                </div>
              )}

              {/* Match list */}
              {result.matches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {result.matches.map((match: DetectMatch, i) => (
                    <div key={i} className="glass-card" style={{
                      padding: '16px',
                      background: match.isInfringing ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${match.isInfringing ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                            {match.content?.fileName || `Content ${match.contentId.substring(0, 12)}...`}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Owner: {match.content?.owner?.substring(0, 8) || 'unknown'}...
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Frames matched: {match.matchedFrames}/{match.totalFrames}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: '800',
                            color: getSimilarityColor(match.similarityScore),
                          }}>
                            {match.similarityScore.toFixed(1)}%
                          </div>
                          <span className={`badge-premium ${match.isInfringing ? 'badge-warning' : 'badge-original'}`} style={{ fontSize: '10px' }}>
                            {match.isInfringing ? 'INFRINGING' : 'SIMILAR'}
                          </span>
                        </div>
                      </div>
                      {match.content?.ipfsCid && (
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${match.content.ipfsCid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-premium"
                            style={{ fontSize: '12px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', textDecoration: 'none' }}
                          >
                            View IPFS ↗
                          </a>
                          
                          {match.isInfringing && (
                            <button
                              onClick={() => handleEscalate(match)}
                              className="btn-premium btn-primary"
                              style={{ fontSize: '12px', padding: '8px 16px' }}
                            >
                              Escalate to DisputeDAO
                            </button>
                          )}
                        </div>
                      )}
                      
                      {(match as any).disputeTx && (
                        <div style={{ marginTop: '12px', fontSize: '11px', color: '#10b981', borderTop: '1px solid rgba(16,185,129,0.2)', paddingTop: '8px' }}>
                          Case ESCALATED to DAO: <a href={(match as any).explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View Tx ↗</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              height: '350px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '64px', opacity: 0.15, marginBottom: '16px' }}>🔬</div>
              <p>Upload a file and click "Run Forensic Scan"</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Results will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* DAO Governance footer */}
      <div className="glass-card" style={{ marginTop: '40px', background: 'rgba(99,102,241,0.03)', border: '1px solid var(--secondary-glow)' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>⚖️ DAO Governance & On-Chain Evidence</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
          Detection results are logged to the <strong>copyright_claims</strong> table and can be escalated
          to the <strong>DisputeDAO.sol</strong> smart contract for token-holder voting.
          All pHash metadata is permanently stored on IPFS via Pinata and anchored to the Base blockchain.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DisputeEvidence;
