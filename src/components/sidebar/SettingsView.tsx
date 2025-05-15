
"use client";

import type { AISettings } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Cog, Server, ShieldAlert, ShieldCheck, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth"; 
import { cn } from "@/lib/utils";
import React from "react";

interface SettingsViewProps {
  settings: AISettings;
  onSettingsChange: (newSettings: AISettings) => void;
  onCheckSingleApiKeyStatus: (apiKey: string, keyIndex: number) => void; // Updated prop
  isCheckingApiKey: boolean;
  activeKeyIndexForCheck: number | null; // To show loader on specific key
}

export function SettingsView({
  settings,
  onSettingsChange,
  onCheckSingleApiKeyStatus,
  isCheckingApiKey,
  activeKeyIndexForCheck,
}: SettingsViewProps) {
  const { toast } = useToast();
  const { isCreatorLoggedIn } = useAuth(); 

  const [localApiKeys, setLocalApiKeys] = React.useState<string[]>(settings.apiKeys || Array(5).fill(""));
  const [localModel, setLocalModel] = React.useState(settings.model);

  React.useEffect(() => {
    setLocalApiKeys(settings.apiKeys && settings.apiKeys.length === 5 ? settings.apiKeys : Array(5).fill(""));
    setLocalModel(settings.model);
  }, [settings.apiKeys, settings.model]);

  const handleApiKeyChange = (index: number, value: string) => {
    const newKeys = [...localApiKeys];
    newKeys[index] = value;
    setLocalApiKeys(newKeys);
  };

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
      apiKeys: localApiKeys.map(key => key.trim()),
      model: localModel.trim(), 
      provider: settings.provider, // This is mostly for display if direct calling OpenRouter
      currentApiKeyIndex: settings.currentApiKeyIndex, // Preserve current index or reset as needed
    };
    onSettingsChange(newSettings);
  };

  const areAnyApiKeysSet = localApiKeys.some(key => key && key.trim() !== "");

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
         <CardDescription className="flex items-start gap-1 text-xs text-muted-foreground pt-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Client-side API key storage is less secure. For production, use a backend proxy. API keys are stored in your browser's local storage for this session.</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`apiKeyGroup-${index}`} className="space-y-2">
              <Label htmlFor={`apiKey-${index}`} className="flex items-center gap-1 text-sm">
                <KeyRound className="h-4 w-4 text-primary/80" />
                API Key {index + 1}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`apiKey-${index}`}
                  name={`apiKey-${index}`}
                  type={isCreatorLoggedIn ? "text" : "password"}
                  value={isCreatorLoggedIn ? localApiKeys[index] : (localApiKeys[index] && localApiKeys[index].trim() !== "" ? "**********" : "")}
                  onChange={isCreatorLoggedIn ? (e) => handleApiKeyChange(index, e.target.value) : undefined}
                  placeholder={isCreatorLoggedIn ? `Enter API Key ${index + 1}` : (localApiKeys[index] && localApiKeys[index].trim() !== "" ? "Set by Creator" : "Not Configured")}
                  className="glassmorphic-input flex-1"
                  readOnly={!isCreatorLoggedIn}
                  disabled={!isCreatorLoggedIn || (isCheckingApiKey && activeKeyIndexForCheck === index)}
                />
                {isCreatorLoggedIn && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCheckSingleApiKeyStatus(localApiKeys[index], index)}
                    disabled={!localApiKeys[index]?.trim() || (isCheckingApiKey && activeKeyIndexForCheck === index)}
                    className="whitespace-nowrap px-2.5"
                  >
                    {(isCheckingApiKey && activeKeyIndexForCheck === index) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Check</span>
                  </Button>
                )}
              </div>
               {!localApiKeys[index]?.trim() && !isCreatorLoggedIn && (
                   <p className="text-xs text-destructive/80 flex items-center gap-1 mt-1">
                      <XCircle className="h-3 w-3"/> API Key {index + 1} not configured.
                   </p>
              )}
            </div>
          ))}
          
          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-1 text-sm">
              <Cog className="h-4 w-4 text-primary/80" />
              Model
            </Label>
            <Input
              id="model"
              name="model"
              value={isCreatorLoggedIn ? localModel : (areAnyApiKeysSet && settings.model ? settings.model : "Not Configured")}
              onChange={isCreatorLoggedIn ? (e) => setLocalModel(e.target.value) : undefined}
              placeholder={isCreatorLoggedIn ? "e.g., qwen/qwen3-235b-a22b:free" : (areAnyApiKeysSet && settings.model ? settings.model : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none")}
              readOnly={!isCreatorLoggedIn}
              disabled={!isCreatorLoggedIn || isCheckingApiKey}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider" className="flex items-center gap-1 text-sm">
              <Server className="h-4 w-4 text-primary/80" /> 
              Provider (OpenRouter)
            </Label>
            <Input
              id="provider"
              name="provider" 
              value={settings.provider}
              placeholder={isCreatorLoggedIn ? settings.provider : (areAnyApiKeysSet && settings.provider ? settings.provider : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none", "bg-muted/30 cursor-not-allowed")}
              readOnly
              disabled
            />
          </div>
          {isCreatorLoggedIn && (
            <Button 
              type="submit" 
              className="w-full bg-primary/80 hover:bg-primary text-primary-foreground" 
              disabled={isCheckingApiKey || !localApiKeys.some(key => key.trim()) || !localModel.trim()}
            >
              Save Settings for Session
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
