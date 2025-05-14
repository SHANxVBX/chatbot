
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  isCreatorLoggedIn: boolean;
  login: (username_input: string, password_input: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CREATOR_AUTH_KEY = 'creatorLoggedIn';
// Hardcoded credentials
const CREATOR_USERNAME = "pannikutty";
const CREATOR_PASSWORD = "Hxp652728";


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCreatorLoggedIn, setIsCreatorLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAuthStatus = localStorage.getItem(CREATOR_AUTH_KEY);
      if (storedAuthStatus === 'true') {
        setIsCreatorLoggedIn(true);
      }
    }
  }, []);

  const login = useCallback(async (username_input: string, password_input: string): Promise<boolean> => {
    if (username_input === CREATOR_USERNAME && password_input === CREATOR_PASSWORD) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(CREATOR_AUTH_KEY, 'true');
      }
      setIsCreatorLoggedIn(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREATOR_AUTH_KEY);
    }
    setIsCreatorLoggedIn(false);
    router.push('/'); // Redirect to home page after logout
  }, [router]);

  const authProviderValue: AuthContextType = { isCreatorLoggedIn, login, logout };

  // Use AuthContext.Provider directly
  return (
    <AuthContext.Provider value={authProviderValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
