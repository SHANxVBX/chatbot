
"use client";

import { Button } from "@/components/ui/button";
import { CyberLogoIcon } from "@/components/icons/CyberLogoIcon";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Settings, Moon, Sun, LogIn, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export function AppHeader() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { isCreatorLoggedIn, logout } = useAuth();

  useEffect(() => {
    setMounted(true);
    const currentTheme = document.documentElement.classList.contains('dark');
    setIsDarkMode(currentTheme);
  }, []);

  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    if (newIsDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/30 bg-background/50 px-4 backdrop-blur-lg md:px-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" /> {/* Placeholder for settings button */}
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/30 bg-background/80 px-4 shadow-md backdrop-blur-lg md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger /> {/* Removed md:hidden to make it always visible */}
        <CyberLogoIcon className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold tracking-tighter" style={{ textShadow: '0 0 5px hsl(var(--primary)/0.7)'}}>
          CyberChat <span className="text-primary">AI</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        
        {/* Settings button now visible to all users */}
        <Button variant="ghost" size="icon" asChild aria-label="Settings">
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>

        {isCreatorLoggedIn ? (
          <Button variant="ghost" onClick={logout} className="text-sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          <Button variant="ghost" asChild className="text-sm">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Creator Login
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
