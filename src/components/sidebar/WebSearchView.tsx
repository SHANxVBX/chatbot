"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface WebSearchViewProps {
  onWebSearch: (query: string) => void;
  isSearching: boolean;
}

export function WebSearchView({ onWebSearch, isSearching }: WebSearchViewProps) {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const handleSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search term.",
        variant: "destructive",
      });
      return;
    }
    onWebSearch(query);
    // Query state can be cleared by parent if needed, or here after search is initiated.
    // setQuery(""); 
  };

  return (
    <Card className="glassmorphic border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          Smart Web Search
        </CardTitle>
        <CardDescription>Let AI search the web and summarize findings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="search-query" className="sr-only">Search Query</Label>
          <Input
            id="search-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query..."
            className="glassmorphic-input"
            disabled={isSearching}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isSearching) {
                handleSearch();
              }
            }}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="w-full bg-primary/80 hover:bg-primary text-primary-foreground"
        >
          {isSearching ? "Searching..." : "Search & Summarize"}
          <Search className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
