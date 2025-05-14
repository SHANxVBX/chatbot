"use client";

import { Button } from "@/components/ui/button";
import { CyberLogoIcon } from "@/components/icons/CyberLogoIcon";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Settings, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

export function AppHeader() {
  const { toggleSidebar } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Check initial theme from HTML element
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
    // You might want to save this preference in localStorage
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
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/30 bg-background/80 px-4 shadow-md backdrop-blur-lg md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <CyberLogoIcon className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold tracking-tighter" style={{ textShadow: '0 0 5px hsl(var(--primary)/0.7)'}}>
          CyberChat <span className="text-primary">AI</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        {/* Settings button could open a dialog or navigate to a settings page */}
        {/* <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Button> */}
      </div>
    </header>
  );
}
