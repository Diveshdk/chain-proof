import React, { useEffect, useState } from 'react';
import { getAllPosts, getRegistryStats } from '../services/api';
import type { RegistryStats } from '../services/api';
import { contractService } from '../services/contractService';

interface ContentItem {
  id: string;
  user_id: string;
  file_name: string;
  ipfs_cid: string;
  file_type: string;
  is_original: boolean;
  royalty_fee: number;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);   // Default FALSE → show button
  const [claimLoading, setClaimLoading] = useState(true); // True while we check balance

  const loadDashboard = async () => {
    try {
      // Fetch non-blockchain data first (always works)
      const [postsData, statsData] = await Promise.all([
        getAllPosts(),
        getRegistryStats(),
      ]);
      setPosts(postsData || []);
      setStats(statsData);

      // hasClaimedTokens() handles its own errors — returns false (show button) on any failure
      const claimed = await contractService.hasClaimedTokens();
      setHasClaimed(claimed);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
      setClaimLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);


  const handleClaim = async () => {
    setTxPending(true);
    try {
      await contractService.claimTokens();
      setHasClaimed(true);
      alert('Congratulations! You claimed 100 CGT Welcome Bonus.');
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const handleDispute = async (post: ContentItem) => {
    if (!window.confirm(`Are you sure you want to open a formal dispute against "${post.file_name}"?`)) return;
    
    setTxPending(true);
    try {
      await contractService.createDispute(
        post.ipfs_cid, // Pass CID for on-chain lookup
        post.user_id,
        `https://gateway.pinata.cloud/ipfs/${post.ipfs_cid}`
      );
      alert('Dispute successfully escalated to the DAO! You can track it in the DAO Governance section.');
    } catch (err: any) {
      alert(`Dispute failed: ${err.message}`);
    } finally {
      setTxPending(false);
    }
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="premium-text" style={{ fontSize: '28px' }}>Content Feed</h1>
          <p className="subtitle">Discover and protect original digital works.</p>
        </div>
        {!claimLoading && !hasClaimed && (
          <button 
            onClick={handleClaim}
            disabled={txPending}
            className="btn-premium btn-primary animate-scale"
            style={{ padding: '10px 20px', fontSize: '12px', borderRadius: '12px' }}
          >
            {txPending ? '⏳ Minting...' : '🎁 Claim 100 CGT'}
          </button>
        )}
      </header>

      {/* Stat summary bar */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Originals</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats?.originalContent ?? '...'}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats?.totalContent ?? '...'}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Claims</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>{stats?.totalClaims ?? '...'}</div>
        </div>
      </div>

      {/* Vertical Feed */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}>
            <div className="loader" style={{ margin: '0 auto' }}></div>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-secondary)' }}>
            No registered content found.
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Card Header (Owner) */}
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: '14px' }}>👤</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {post.user_id.substring(0, 6)}...{post.user_id.substring(38)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Registered {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Media (Full Image) */}
              <div style={{ width: '100%', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {post.file_type === 'video' ? (
                  <video 
                    src={`https://gateway.pinata.cloud/ipfs/${post.ipfs_cid}`} 
                    controls 
                    style={{ width: '100%', maxHeight: '600px' }} 
                  />
                ) : (
                  <img 
                    src={`https://gateway.pinata.cloud/ipfs/${post.ipfs_cid}`} 
                    alt={post.file_name}
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '700px', objectFit: 'contain' }}
                  />
                )}
              </div>

              {/* Post Content & Actions */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', margin: 0 }}>{post.file_name}</h3>
                    {post.royalty_fee > 0 && (
                      <div className="badge-premium" style={{ display: 'inline-block', fontSize: '11px', marginTop: '4px' }}>
                        Royalty Share: {post.royalty_fee}%
                      </div>
                    )}
                  </div>
                  {post.is_original ? (
                    <span className="badge-premium badge-original">✓ Verified Original</span>
                  ) : (
                    <span className="badge-premium badge-warning">Secondary Match</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${post.ipfs_cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-premium btn-secondary"
                    style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: '13px' }}
                  >
                    View Original ↗
                  </a>
                  <button
                    onClick={() => handleDispute(post)}
                    className="btn-premium btn-primary"
                    style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                    disabled={txPending}
                  >
                    Dispute Content
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
      {txPending && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <p style={{ marginTop: '20px' }}>Syncing with Blockchain...</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
