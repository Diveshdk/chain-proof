import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { contractService } from '../services/contractService';

interface Post {
  id: string;
  user_id: string;
  file_name: string;
  ipfs_cid: string;
  is_original: boolean;
  royalty_fee: number;
  created_at: string;
}

const ContentRegistry: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [txPending, setTxPending] = useState(false);

  const handleDispute = async (post: Post) => {
    if (!window.confirm(`Are you sure you want to open a formal dispute against "${post.file_name}"? This will be escalated to the DAO for voting.`)) {
      return;
    }

    setTxPending(true);
    try {
      await contractService.createDispute(
        post.ipfs_cid,
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

  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const { data } = await axios.get(`${apiBase}/api/upload/all`);
        setPosts(data.data);
      } catch (error) {
        console.error('Fetch all posts failed', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, []);

  const filteredPosts = posts.filter(p => 
    (p.file_name || '').toLowerCase().includes(filter.toLowerCase()) || 
    (p.user_id || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '40px' }}>
        <h1>Global Content Registry</h1>
        <p className="subtitle">Exploration of all registered digital assets and their cryptographic fingerprints.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <input 
          type="text" 
          placeholder="Search by filename, wallet address, or content hash..." 
          className="glass-card"
          style={{ 
            width: '100%', 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-main)',
            padding: '16px'
          }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '20px 24px', fontSize: '14px', color: 'var(--text-muted)' }}>Content</th>
              <th style={{ padding: '20px 24px', fontSize: '14px', color: 'var(--text-muted)' }}>Owner</th>
              <th style={{ padding: '20px 24px', fontSize: '14px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '20px 24px', fontSize: '14px', color: 'var(--text-muted)' }}>Created At</th>
              <th style={{ padding: '20px 24px', fontSize: '14px', color: 'var(--text-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>Syncing with decentralised vault...</td></tr>
            ) : filteredPosts.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>No records found matching your query.</td></tr>
            ) : (
              filteredPosts.map(post => (
                <tr key={post.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: '600' }}>{post.file_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>CID: {post.ipfs_cid?.substring(0, 12)}...</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontFamily: 'JetBrains Mono' }}>{post.user_id?.substring(0, 6)}...{post.user_id?.substring(38)}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <span className={`badge-premium ${post.is_original ? 'badge-original' : 'badge-warning'}`}>
                      {post.is_original ? 'Verified Original' : 'Secondary'}
                    </span>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a 
                        href={`https://gateway.pinata.cloud/ipfs/${post.ipfs_cid}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-premium btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                      >
                        IPFS
                      </a>
                      <button 
                        onClick={() => handleDispute(post)}
                        className="btn-premium btn-primary"
                        style={{ padding: '6px 12px', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                        disabled={txPending}
                      >
                        Dispute
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {txPending && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <p style={{ marginTop: '20px' }}>Initiating On-Chain Dispute...</p>
        </div>
      )}
    </div>
  );
};

export default ContentRegistry;
