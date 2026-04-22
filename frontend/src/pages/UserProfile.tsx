import React, { useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import axios from 'axios';

interface Post {
  id: string;
  file_name: string;
  ipfs_cid: string;
  is_original: boolean;
  royalty_fee: number;
  created_at: string;
}

const UserProfile: React.FC = () => {
  const { user } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const { data } = await axios.get(`${apiBase}/api/upload/user/${user.walletAddress}`);
        setPosts(data.data);
      } catch (error) {
        console.error('Fetch profile posts failed', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  if (!user) return null;

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '40px' }}>
        <h1>My Profile</h1>
        <p className="subtitle">Manage your registered content and track your copyright status.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ 
            width: '80px', height: '80px', 
            borderRadius: '50%', 
            background: 'var(--accent-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px'
          }}>👤</div>
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>{user.walletAddress.substring(0, 6)}...{user.walletAddress.substring(38)}</h2>
            <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>Verified Creator</div>
          </div>
        </div>
      </div>

      <section>
        <h2 style={{ marginBottom: '24px' }}>Your Content Registry</h2>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">Total Uploads</div>
            <div className="stat-value">{posts.length}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Original Content</div>
            <div className="stat-value">{posts.filter(p => p.is_original).length}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Potential Royalties</div>
            <div className="stat-value">0.00 ETH</div>
          </div>
        </div>

        {loading ? (
          <div>Loading your content...</div>
        ) : (
          <div className="glass-card">
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No content registered yet. Start by uploading something!
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {posts.map(post => (
                  <div key={post.id} className="glass-card" style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{post.file_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                        IPFS: {post.ipfs_cid?.substring(0, 10)}...
                      </div>
                    </div>
                    <div>
                      {post.is_original ? (
                        <span className="badge-premium badge-original">✅ Original</span>
                      ) : (
                        <span className="badge-premium badge-warning">⚠️ Indexed Duplicate</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default UserProfile;
