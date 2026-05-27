import { createContext, useContext, useState, ReactNode } from 'react';
import socket from '../socket';

interface AuthUser {
  id: string;
  loginId: string;
  fullName: string;
  role: 'ADMIN' | 'SALES_MANAGER' | 'FINANCE_OFFICER' | 'FINANCE_HEAD' | 'CLUSTER_MANAGER';
  branchId: string | null;
  clusterNumber: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });

  const login = (t: string, u: AuthUser) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    socket.connect();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    socket.disconnect();
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
