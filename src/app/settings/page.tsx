
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useChatController } from '@/hooks/useChatController';
import { SettingsView } from '@/components/sidebar/SettingsView'; // Re-using for AI provider settings
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Settings as SettingsIcon, Palette, ToggleRight } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { isCreatorLoggedIn } = useAuth();
  const router = useRouter();
  const {
    settings,
    setSettings,
    checkSingleApiKeyStatus,
    isCheckingApiKey,
    activeKeyIndexForCheck,
  } = useChatController();

  useEffect(() => {
    if (!isCreatorLoggedIn) {
      router.push('/login'); // Redirect to login if not creator
    }
  }, [isCreatorLoggedIn, router]);

  if (!isCreatorLoggedIn) {
    // Optional: Show a loading or access denied message while redirecting
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl glassmorphic">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You must be logged in as a creator to access this page.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-4xl mb-8">
        <Button variant="outline" size="sm" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Chat
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Application Settings</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Manage AI provider credentials and other application configurations.
        </p>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        <Card className="glassmorphic shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">AI Provider Configuration</CardTitle>
            <CardDescription>
              Set up API keys and model preferences for the AI service. Changes are saved to your browser's local storage for your session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsView
              settings={settings}
              onSettingsChange={setSettings}
              onCheckSingleApiKeyStatus={checkSingleApiKeyStatus}
              isCheckingApiKey={isCheckingApiKey}
              activeKeyIndexForCheck={activeKeyIndexForCheck}
            />
          </CardContent>
        </Card>

        <Card className="glassmorphic shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Chat Interface Customization</CardTitle>
            </div>
            <CardDescription>
              Personalize the look and feel of the chat. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">More customization options for the chat interface will be available here in a future update.</p>
            {/* Example placeholder for a future setting */}
            {/* 
            <div className="mt-4 space-y-2">
              <Label htmlFor="fontSize">Chat Font Size</Label>
              <Select disabled>
                <SelectTrigger id="fontSize"><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div> 
            */}
          </CardContent>
        </Card>

        <Card className="glassmorphic shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ToggleRight className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Feature Toggles</CardTitle>
            </div>
            <CardDescription>
              Enable or disable specific chatbot features. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Control advanced features such as enabling/disabling web search for all users, or other AI capabilities from this section in a future update.</p>
            {/* Example placeholder for a future toggle */}
            {/*
            <div className="mt-4 flex items-center space-x-2">
              <Switch id="enable-history" disabled />
              <Label htmlFor="enable-history">Enable Chat History Sync (Cloud)</Label>
            </div>
            */}
          </CardContent>
        </Card>
      </main>
      <footer className="w-full max-w-4xl mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} CyberChat AI. All settings are managed by the Creator.</p>
      </footer>
    </div>
  );
}
