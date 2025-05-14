"use client";

import type { AISettings } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Cog, DatabaseZap } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SettingsViewProps {
  settings: AISettings;
  onSettingsChange: (newSettings: AISettings) => void;
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newSettings: AISettings = {
      apiKey: formData.get("apiKey") as string,
      model: formData.get("model") as string,
      provider: formData.get("provider") as string,
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
          <DatabaseZap className="h-5 w-5 text-primary" />
          AI Provider Settings
        </CardTitle>
        <CardDescription>Configure your AI model and API access.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1 text-sm">
              <KeyRound className="h-4 w-4 text-primary/80" />
              API Key (e.g., OpenRouter)
            </Label>
            <Input
              id="apiKey"
              name="apiKey"
              type="password"
              defaultValue={settings.apiKey}
              placeholder="sk-or-..."
              className="glassmorphic-input"
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
              defaultValue={settings.model}
              placeholder="e.g., mistralai/mixtral-8x7b-instruct"
              className="glassmorphic-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider" className="flex items-center gap-1 text-sm">
              <DatabaseZap className="h-4 w-4 text-primary/80" />
              Provider (Conceptual)
            </Label>
            <Input
              id="provider"
              name="provider"
              defaultValue={settings.provider}
              placeholder="e.g., OpenRouterProvider"
              className="glassmorphic-input"
              disabled // For now, this is conceptual
            />
          </div>
          <Button type="submit" className="w-full bg-primary/80 hover:bg-primary text-primary-foreground">
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
