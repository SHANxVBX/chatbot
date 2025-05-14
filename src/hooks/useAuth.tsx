
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react'; // Import ReactNode
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isCreatorLoggedIn: boolean;
  login: (username_input: string, password_input: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CREATOR_AUTH_KEY = 'creatorLoggedIn';
// Updated username and HASHED password
const CREATOR_USERNAME = "pannikutty";
// SHA-256 hash of "Hxp652728"
const HASHED_CREATOR_PASSWORD = "2d8f68c30e08f12b048a43e5658d8e8b1098f3688e576f2e0a5b7774819a5a07";

// Helper function to hash a string using SHA-256
async function sha256(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  // Fallback for environments where crypto.subtle is not available
  console.warn('Web Crypto API not available for password hashing. Login may not be secure.');
  // For server-side or Node.js environments if ever needed (though this hook is client-side)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
  }
  return str; // Insecure fallback
}


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
    const hashed_password_input = await sha256(password_input);
    if (username_input === CREATOR_USERNAME && hashed_password_input === HASHED_CREATOR_PASSWORD) {
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

