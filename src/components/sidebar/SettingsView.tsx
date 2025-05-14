
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
      model: formData.get("model") as string, // This will correctly get the model name
      provider: formData.get("provider") as string, // This will correctly get the provider name
    };
    onSettingsChange(newSettings);
    toast({
      title: "Settings Saved",
      description: "AI provider settings have been updated.",
      variant: "default",
    });
  };

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
              defaultValue={isCreatorLoggedIn ? settings.apiKey : "**********"}
              placeholder={isCreatorLoggedIn ? "Enter your API key" : "Set by Creator"}
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
            {/* Hidden input to hold the actual model value for form submission when creator is logged in */}
            {isCreatorLoggedIn && (
                <Input
                    type="hidden"
                    name="model"
                    value={settings.model}
                />
            )}
            <Input
              id="model"
              name={isCreatorLoggedIn ? "model" : "model_display"} // Use a different name for display when not logged in
              value={isCreatorLoggedIn ? settings.model : "Permission Denied to View"}
              onChange={isCreatorLoggedIn ? (e) => onSettingsChange({...settings, model: e.target.value}) : undefined}
              placeholder={isCreatorLoggedIn ? "e.g., openrouter/auto" : "Permission Denied to View"}
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
             {/* Hidden input to hold the actual provider value for form submission by creator */}
            {isCreatorLoggedIn && (
                <Input
                    type="hidden"
                    name="provider"
                    value={settings.provider} // This ensures "OpenRouter" is submitted
                />
            )}
            <Input
              id="provider"
              name={isCreatorLoggedIn ? "provider" : "provider_display"} // Use different name for display when not logged in
              value={isCreatorLoggedIn ? settings.provider : "Permission Denied to View"}
              placeholder={isCreatorLoggedIn ? "e.g., OpenRouter" : "Permission Denied to View"}
              className={cn("glassmorphic-input", !isCreatorLoggedIn && "select-none pointer-events-none")}
              readOnly // Provider is not user-editable in this app
              disabled={!isCreatorLoggedIn} // Visually and interactively disabled for non-creators
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
