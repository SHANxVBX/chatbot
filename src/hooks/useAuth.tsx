"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isCreatorLoggedIn: boolean;
  login: (username_input: string, password_input: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CREATOR_AUTH_KEY = 'creatorLoggedIn';
// Ensure these are exactly as required.
const CREATOR_USERNAME = "pannikutty";
// This is the new SHA-256 hash provided by the user.
const HASHED_CREATOR_PASSWORD = "d6e8c7a4a4b1a6f7a7f1b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8";

// Helper function to hash a string using SHA-256 (client-side focused)
async function sha256(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  // Fallback for environments where crypto.subtle is not available
  console.warn('Web Crypto API (window.crypto.subtle) not available for password hashing. Login will likely fail and is not secure.');
  return str; // Insecure fallback: login will fail if comparing plain text to a hash.
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
    // Ensure inputs are trimmed directly within this function for robust comparison.
    const trimmedUsername = username_input.trim();
    const trimmedPassword = password_input.trim();

    const hashed_password_input = await sha256(trimmedPassword);
    
    // console.log("Attempting login with:");
    // console.log("Input Username (trimmed):", `"${trimmedUsername}"`);
    // console.log("Expected Username:", `"${CREATOR_USERNAME}"`);
    // console.log("Input Password Hash:", `"${hashed_password_input}"`);
    // console.log("Expected Password Hash:", `"${HASHED_CREATOR_PASSWORD}"`);

    const usernameMatch = trimmedUsername === CREATOR_USERNAME;
    const passwordMatch = hashed_password_input === HASHED_CREATOR_PASSWORD;

    // console.log("Username Match:", usernameMatch);
    // console.log("Password Match:", passwordMatch);

    if (usernameMatch && passwordMatch) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(CREATOR_AUTH_KEY, 'true');
      }
      setIsCreatorLoggedIn(true);
      // console.log("Login successful");
      return true;
    }
    // console.log("Login failed");
    return false;
  }, [setIsCreatorLoggedIn]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREATOR_AUTH_KEY);
    }
    setIsCreatorLoggedIn(false);
    router.push('/'); 
  }, [router, setIsCreatorLoggedIn]);

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
