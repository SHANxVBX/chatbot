
"use client";

import type { AISettings } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Cog, Server, ShieldAlert, ShieldCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth"; 
import { cn } from "@/lib/utils";
import React from "react";


interface SettingsViewProps {
  settings: AISettings;
  onSettingsChange: (newSettings: AISettings) => void;
  onCheckApiKeyStatus: () => void;
  isCheckingApiKey: boolean;
}

export function SettingsView({ settings, onSettingsChange, onCheckApiKeyStatus, isCheckingApiKey }: SettingsViewProps) {
  const { toast } = useToast();
  const { isCreatorLoggedIn } = useAuth(); 

  // Local state for inputs to allow typing before saving
  const [localApiKey, setLocalApiKey] = React.useState(settings.apiKey);
  const [localModel, setLocalModel] = React.useState(settings.model);

  React.useEffect(() => {
    setLocalApiKey(settings.apiKey);
    setLocalModel(settings.model);
  }, [settings.apiKey, settings.model]);


  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCreatorLoggedIn) {
      toast({
        title: "Permission Denied",
        description: "Only creators can modify AI settings.",
        variant: "destructive",
      });
      return;
    }
    
    const newSettings: AISettings = {
      apiKey: localApiKey.trim(),
      model: localModel.trim(), 
      provider: settings.provider, // Provider is not directly editable by user here
    };
    onSettingsChange(newSettings);
  };

  const isApiKeySet = settings.apiKey && settings.apiKey.trim() !== "";
  const isLocalApiKeyEntered = localApiKey && localApiKey.trim() !== "";

  return (
    <Card className="glassmorphic border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cog className="h-5 w-5 text-primary" /> 
          AI Provider Settings
        </CardTitle>
        {!isCreatorLoggedIn && (
            <CardDescription className="flex items-center gap-1 text-sm text-amber-500 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" /> Settings are view-only. Log in as creator to modify.
            </CardDescription>
        )}
         {isCreatorLoggedIn && (
            <CardDescription className="flex items-center gap-1 text-sm text-green-500 dark:text-green-400">
                <ShieldCheck className="h-4 w-4" /> Creator mode: Settings are editable.
            </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1 text-sm">
              <KeyRound className="h-4 w-4 text-primary/80" />
              API Key
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="apiKey"
                name="apiKey"
                type={isCreatorLoggedIn ? "text" : "password"}
                value={isCreatorLoggedIn ? localApiKey : (isApiKeySet ? "**********" : "")}
                onChange={isCreatorLoggedIn ? (e) => setLocalApiKey(e.target.value) : undefined}
                placeholder={isCreatorLoggedIn ? "Enter your API key" : (isApiKeySet ? "Set by Creator" : "Not Configured")}
                className="glassmorphic-input flex-1"
                readOnly={!isCreatorLoggedIn}
                disabled={!isCreatorLoggedIn || isCheckingApiKey}
              />
              {isCreatorLoggedIn && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCheckApiKeyStatus}
                  disabled={!isLocalApiKeyEntered || isCheckingApiKey}
                  className="whitespace-nowrap"
                >
                  {isCheckingApiKey ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Check Status
                </Button>
              )}
            </div>
             {!isApiKeySet && !isCreatorLoggedIn && (
                 <p className="text-xs text-destructive/80 flex items-center gap-1 mt-1">
                    <XCircle className="h-3 w-3"/> API Key not configured by creator. AI is offline.
                 </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-1 text-sm">
              <Cog className="h-4 w-4 text-primary/80" />
              Model
            </Label>
            <Input
              id="model"
              name="model"
              value={isCreatorLoggedIn ? localModel : (isApiKeySet && settings.model ? settings.model : "Not Configured")}
              onChange={isCreatorLoggedIn ? (e) => setLocalModel(e.target.value) : undefined}
              placeholder={isCreatorLoggedIn ? "e.g., qwen/qwen3-235b-a22b:free" : (isApiKeySet && settings.model ? settings.model : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none")}
              readOnly={!isCreatorLoggedIn}
              disabled={!isCreatorLoggedIn || isCheckingApiKey}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider" className="flex items-center gap-1 text-sm">
              <Server className="h-4 w-4 text-primary/80" /> 
              Provider
            </Label>
            <Input
              id="provider"
              name="provider" 
              value={settings.provider} // Provider is not directly editable from UI
              placeholder={isCreatorLoggedIn ? settings.provider : (isApiKeySet && settings.provider ? settings.provider : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none", "bg-muted/30 cursor-not-allowed")}
              readOnly // Provider is not user-editable in this app
              disabled // Always disabled as it's fixed to OpenRouter
            />
          </div>
          {isCreatorLoggedIn && (
            <Button type="submit" className="w-full bg-primary/80 hover:bg-primary text-primary-foreground" disabled={isCheckingApiKey || !localApiKey.trim() || !localModel.trim()}>
              Save Settings for Session
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

