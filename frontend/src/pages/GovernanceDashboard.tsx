import React, { useState, useEffect } from 'react';
import { contractService } from '../services/contractService';
import { ethers } from 'ethers';

interface Dispute {
  id: number;
  contentId: string;
  claimant: string;
  original: string;
  evidence: string;
  votesFor: bigint;
  votesAgainst: bigint;
  createdAt: number;
  status: number;
}

const GovernanceDashboard: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const count = await contractService.getDisputeCount();
      const list: Dispute[] = [];
      for (let i = 0; i < count; i++) {
        const d = await contractService.getDispute(i);
        if (d) list.push(d as any);
      }
      setDisputes(list.reverse()); // Newest first
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch disputes from blockchain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleVote = async (id: number, support: boolean) => {
    setTxPending(true);
    try {
      await contractService.vote(id, support);
      await fetchDisputes();
    } catch (err: any) {
      alert(`Voting failed: ${err.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const handleResolve = async (id: number) => {
    setTxPending(true);
    try {
      await contractService.resolveDispute(id);
      await fetchDisputes();
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    } finally {
      setTxPending(false);
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return <span style={{ color: '#fbbf24' }}>Pending</span>;
      case 1: return <span style={{ color: '#10b981' }}>Resolved (Supported Original)</span>;
      case 2: return <span style={{ color: '#ef4444' }}>Rejected (Supported Claimant)</span>;
      default: return 'Unknown';
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 className="premium-text" style={{ fontSize: '32px', marginBottom: '10px' }}>
          DAO Governance Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review copyright disputes and vote to protect original creators. Weighted by your CGT balance.
        </p>
      </header>

      {error && <div className="error-box" style={{ marginBottom: '20px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <div className="loader" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Loading Blockchain Data...</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No active disputes found in the DAO.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {disputes.map((d) => (
            <div key={d.id} className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Dispute #{d.id}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Created: {new Date(d.createdAt * 1000).toLocaleString()}
                  </p>
                </div>
                <div style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', fontWeight: 'bold' }}>
                  {getStatusLabel(d.status)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '24px' }}>
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Original Owner</h4>
                  <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{d.original}</p>
                </div>
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Evidence CID</h4>
                  <a 
                    href={d.evidence} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'underline' }}
                  >
                    View Forensic Data ↗
                  </a>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
                  <span>Votes For (Original)</span>
                  <span>Votes Against (Claimant)</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Number(d.votesFor) + Number(d.votesAgainst) === 0 ? 50 : (Number(d.votesFor) / (Number(d.votesFor) + Number(d.votesAgainst))) * 100}%`, 
                    background: 'var(--primary)' 
                  }}></div>
                  <div style={{ 
                    width: `${Number(d.votesFor) + Number(d.votesAgainst) === 0 ? 50 : (Number(d.votesAgainst) / (Number(d.votesFor) + Number(d.votesAgainst))) * 100}%`, 
                    background: '#ef4444' 
                  }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>{ethers.formatEther(d.votesFor)} CGT</span>
                  <span>{ethers.formatEther(d.votesAgainst)} CGT</span>
                </div>
              </div>

              {d.status === 0 && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    disabled={txPending}
                    onClick={() => handleVote(d.id, true)}
                    className="btn-premium btn-primary"
                    style={{ flex: 1, padding: '12px' }}
                  >
                    Support Original
                  </button>
                  <button 
                    disabled={txPending}
                    onClick={() => handleVote(d.id, false)}
                    className="btn-premium"
                    style={{ flex: 1, padding: '12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444' }}
                  >
                    Support Claimant
                  </button>
                  <button 
                    disabled={txPending}
                    onClick={() => handleResolve(d.id)}
                    className="btn-premium"
                    style={{ padding: '12px 20px', border: '1px solid rgba(255,255,255,0.2)' }}
                    title="Resolve after 24h"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {txPending && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <p style={{ marginTop: '20px' }}>Processing Transaction...</p>
        </div>
      )}
    </div>
  );
};

export default GovernanceDashboard;
