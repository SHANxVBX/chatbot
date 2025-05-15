
"use client";

import React, { useEffect, useState, ChangeEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useChatController } from '@/hooks/useChatController';
import { SettingsView } from '@/components/sidebar/SettingsView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar as ShadAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Renamed to avoid conflict
import { ArrowLeft, Settings as SettingsIcon, Palette, ToggleRight, UserCircle, UploadCloud, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image'; // For preview

const MAX_AVATAR_SIZE_MB = 2;
const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];


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
  const { toast } = useToast();

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(settings.userAvatarUri || null);
  const avatarInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!isCreatorLoggedIn) {
      router.push('/login');
    }
  }, [isCreatorLoggedIn, router]);

  useEffect(() => { // Sync preview URL if settings change externally
    setAvatarPreviewUrl(settings.userAvatarUri || null);
  }, [settings.userAvatarUri]);


  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
        toast({ title: "Avatar Too Large", description: `Max file size is ${MAX_AVATAR_SIZE_MB}MB.`, variant: "destructive" });
        return;
      }
      if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Please select a JPG, PNG, GIF, or WEBP image.", variant: "destructive" });
        return;
      }
      setSelectedAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSetAvatar = () => {
    if (avatarPreviewUrl && avatarPreviewUrl !== settings.userAvatarUri) {
      setSettings({ ...settings, userAvatarUri: avatarPreviewUrl });
      toast({ title: "Avatar Updated", description: "Your new user avatar has been saved for this session." });
    } else if (!avatarPreviewUrl && settings.userAvatarUri){
       // This case handles removal if preview is cleared but old URI exists
      setSettings({ ...settings, userAvatarUri: undefined });
      toast({ title: "Avatar Removed", description: "Your custom user avatar has been removed." });
    }
    setSelectedAvatarFile(null); // Clear selection
  };

  const handleRemoveAvatar = () => {
    setSettings({ ...settings, userAvatarUri: undefined });
    setAvatarPreviewUrl(null);
    setSelectedAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    toast({ title: "Avatar Removed", description: "Your custom user avatar has been removed." });
  };


  if (!isCreatorLoggedIn) {
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
          Manage AI provider credentials, user appearance, and other application configurations.
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
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Customize User Avatar</CardTitle>
            </div>
            <CardDescription>
              Personalize the avatar displayed for your messages in the chat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-6">
                <ShadAvatar className="h-24 w-24 border-2 border-primary/30 shadow-md">
                    <AvatarImage src={avatarPreviewUrl || undefined} alt="User Avatar Preview" data-ai-hint="abstract avatar" />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                        <UserCircle className="h-12 w-12" />
                    </AvatarFallback>
                </ShadAvatar>
                <div className="flex flex-col items-center space-y-3 w-full max-w-xs text-center">
                    <Label htmlFor="avatar-upload" className="text-sm font-medium">
                        Upload new avatar (Max {MAX_AVATAR_SIZE_MB}MB)
                    </Label>
                    <Input
                        id="avatar-upload"
                        ref={avatarInputRef}
                        type="file"
                        accept={ACCEPTED_AVATAR_TYPES.join(',')}
                        onChange={handleAvatarFileChange}
                        className="w-full text-sm text-foreground
                                   file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0
                                   file:text-sm file:font-semibold file:bg-primary/10 file:text-primary
                                   hover:file:bg-primary/20 cursor-pointer
                                   border border-border/50 rounded-lg p-0.5 glassmorphic-input focus-visible:ring-primary/50"
                    />
                     <p className="text-xs text-muted-foreground pt-1">Accepted formats: JPG, PNG, GIF, WEBP.</p>
                </div>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                {settings.userAvatarUri && (
                     <Button variant="outline" onClick={handleRemoveAvatar} className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground border-destructive/30 hover:border-destructive/50">
                        <Trash2 className="mr-2 h-4 w-4" /> Remove Current Avatar
                    </Button>
                )}
                <Button 
                    onClick={handleSetAvatar} 
                    disabled={!selectedAvatarFile && avatarPreviewUrl === settings.userAvatarUri}
                    className="bg-primary/90 hover:bg-primary"
                >
                    <UploadCloud className="mr-2 h-4 w-4" /> Set Avatar
                </Button>
            </div>
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
          </CardContent>
        </Card>
      </main>
      <footer className="w-full max-w-4xl mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} CyberChat AI. All settings are managed by the Creator.</p>
      </footer>
    </div>
  );
}
