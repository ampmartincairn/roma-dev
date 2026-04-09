import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      setIsLoadingAuth(true);
      try {
        let retries = 0;
        while (!db.initialized() && retries < 50) {
          await new Promise(r => setTimeout(r, 100));
          retries++;
        }
        
        const currentUser = await db.auth.me();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        }
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

  const login = async (username, password) => {
    try {
      setError(null);
      const user = await db.auth.login(username, password);
      setUser(user);
      setIsAuthenticated(true);
      return user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (username, email, password, fullName, companyName, role = 'user') => {
    try {
      setError(null);
      const user = await db.auth.register(username, email, password, fullName, companyName, role);
      setUser(user);
      setIsAuthenticated(true);
      return user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    db.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      error,
      login,
      register,
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