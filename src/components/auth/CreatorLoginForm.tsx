"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, LogIn } from 'lucide-react';

export function CreatorLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    // Trim username and password before sending to login function
    const success = await login(username.trim(), password.trim());
    setIsLoading(false);
    if (success) {
      toast({ title: 'Login Successful', description: 'Redirecting...' });
      router.push('/'); 
    } else {
      toast({ title: 'Login Failed', description: 'Invalid username or password.', variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username" className="flex items-center gap-1 text-sm">
            <KeyRound className="h-4 w-4 text-primary/80" />
            Username
        </Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          required
          className="glassmorphic-input"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="flex items-center gap-1 text-sm">
            <KeyRound className="h-4 w-4 text-primary/80" />
            Password
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
          className="glassmorphic-input"
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full bg-primary/90 hover:bg-primary text-primary-foreground" disabled={isLoading}>
        {isLoading ? 'Logging In...' : 'Log In'}
        <LogIn className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
