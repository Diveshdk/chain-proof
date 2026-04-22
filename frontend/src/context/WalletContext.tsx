import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  walletAddress: string;
  username?: string;
  displayName?: string;
}

interface WalletContextType {
  token: string | null;
  user: User | null;
  login: (address: string, signature: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      // In production, verify token validity or fetch profile
      // For now, decode or trust local storage for UI
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ walletAddress: payload.walletAddress });
      } catch (e) {
        logout();
      }
    }
  }, [token]);

  const login = async (address: string, signature: string) => {
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/verify`, {
        address,
        signature,
      });

      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  return (
    <WalletContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
