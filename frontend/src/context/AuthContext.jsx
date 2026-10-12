import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../lib/apiClient';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/auth/user/')
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    window.location.href = `${BACKEND_URL}/accounts/logout/`;
  };

  return (
    <AuthContext.Provider value={{ user, loading, authenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
