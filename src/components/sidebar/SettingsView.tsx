
"use client";

import type { AISettings } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Cog, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth"; 
import { cn } from "@/lib/utils";

interface SettingsViewProps {
  settings: AISettings;
  onSettingsChange: (newSettings: AISettings) => void;
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const { toast } = useToast();
  const { isCreatorLoggedIn } = useAuth(); 

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
    const formData = new FormData(event.currentTarget);
    const newSettings: AISettings = {
      apiKey: formData.get("apiKey") as string,
      model: formData.get("model") as string, 
      provider: formData.get("provider") as string, 
    };
    onSettingsChange(newSettings);
    // Toast for settings change is handled in useChatController's handleSettingsChange
  };

  const isApiKeySet = settings.apiKey && settings.apiKey.trim() !== "";

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
            <Input
              id="apiKey"
              name="apiKey"
              type={isCreatorLoggedIn ? "text" : "password"}
              defaultValue={isCreatorLoggedIn ? settings.apiKey : (isApiKeySet ? "**********" : "")}
              placeholder={isCreatorLoggedIn ? "Enter your API key" : (isApiKeySet ? "Set by Creator" : "Not Configured")}
              className="glassmorphic-input"
              readOnly={!isCreatorLoggedIn}
              disabled={!isCreatorLoggedIn}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-1 text-sm">
              <Cog className="h-4 w-4 text-primary/80" />
              Model
            </Label>
            <Input
              id="model"
              name="model"
              value={isCreatorLoggedIn ? settings.model : (isApiKeySet && settings.model ? settings.model : "Not Configured")}
              onChange={isCreatorLoggedIn ? (e) => onSettingsChange({...settings, model: e.target.value}) : undefined}
              placeholder={isCreatorLoggedIn ? "e.g., qwen/qwen3-235b-a22b:free" : (isApiKeySet ? "Set by Creator" : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none")}
              readOnly={!isCreatorLoggedIn}
              disabled={!isCreatorLoggedIn}
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
              value={isCreatorLoggedIn ? settings.provider : (isApiKeySet && settings.provider ? settings.provider : "Not Configured")}
              placeholder={isCreatorLoggedIn ? "e.g., OpenRouter" : (isApiKeySet ? "Set by Creator" : "Not Configured")}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none")}
              readOnly // Provider is not user-editable in this app
              disabled={!isCreatorLoggedIn} 
            />
          </div>
          {isCreatorLoggedIn && (
            <Button type="submit" className="w-full bg-primary/80 hover:bg-primary text-primary-foreground">
              Save Settings
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
