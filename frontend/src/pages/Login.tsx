import React, { useState } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useWallet } from '../context/WalletContext';
import axios from 'axios';

const Login: React.FC = () => {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { login } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  
  const handleLogin = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // 1. Get nonce
      const { data: { nonce } } = await axios.get(`${apiBase}/api/auth/nonce/${address}`);
      
      // 2. Sign message
      const message = `Welcome to Copyright Protocol!\n\nPlease sign this message to authenticate.\n\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      
      // 3. Verify on backend
      await login(address, signature);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'var(--bg-deep)'
    }}>
      <div className="glass-card animate-fade" style={{ maxWidth: '450px', width: '90%', textAlign: 'center' }}>
        <div className="logo-icon" style={{ margin: '0 auto 24px', width: '60px', height: '60px', fontSize: '30px' }}>©</div>
        <h1>Copyright Protocol</h1>
        <p className="subtitle">Secure your digital legacy with blockchain-powered ownership and automated royalty detection.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          {!address ? (
            <button 
              className="btn-premium btn-secondary" 
              onClick={() => connect({ connector: injected() })}
              disabled={isPending}
              style={{ width: '100%' }}
            >
              {isPending ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          ) : (
            <button 
              className="btn-premium btn-secondary" 
              onClick={() => disconnect()}
              style={{ width: '100%' }}
            >
              Disconnect Wallet ({address.substring(0,6)}...{address.substring(38)})
            </button>
          )}
          {address && (
            <button 
              className="btn-premium btn-primary" 
              onClick={handleLogin}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Authenticating...' : 'Sign In with Wallet'}
            </button>
          )}
        </div>

        {error && (
          <div className="badge-warning" style={{ marginTop: '20px', padding: '10px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
          By signing in, you agree to our decentralised terms of service.
        </div>
      </div>
    </div>
  );
};

export default Login;
