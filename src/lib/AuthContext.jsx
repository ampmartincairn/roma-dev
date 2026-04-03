import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      setIsLoadingAuth(true);
      try {
        // Wait a bit for DB to fully initialize
        let retries = 0;
        while (!db.initialized() && retries < 50) {
          await new Promise(r => setTimeout(r, 100));
          retries++;
        }
        
        const currentUser = await db.auth.me();
        setUser(currentUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    initialize();
  }, []);

  const logout = () => {
    db.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      logout,
      navigateToLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};