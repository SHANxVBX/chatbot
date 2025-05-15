
// @ts-nocheck
"use client";

import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Added AvatarImage
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { User, Bot, AlertTriangle, FileText, Search, CheckCircle, BrainCog } from "lucide-react";
import Image from "next/image";
import React from "react";

// Basic Markdown-like rendering for newlines, bold, italics, code, and custom collapsible sections
const renderText = (text: string): React.ReactNode[] => {
  if (!text) return [];

  const collapsibleRegex = /^(:::collapsible\s+(.+?)\n([\s\S]*?):::)$/m;
  const markdownElementsRegex = /(\n)|(\*\*.*?\*\*)|(\*.*?\*)|(`.+?`)|(```[\s\S]+?```)/g;

  const parts = text.split(new RegExp(`(${collapsibleRegex.source})`, 'gm')).filter(Boolean);

  return parts.flatMap((part, index) => {
    const collapsibleMatch = part.match(collapsibleRegex);
    if (collapsibleMatch) {
      const title = collapsibleMatch[2];
      const content = collapsibleMatch[3];
      const isWebSearchResult = title.toLowerCase().startsWith("web search results");

      return (
        <details
          key={`details-${index}`}
          className={cn(
            "my-2 p-3 rounded-md shadow-md border",
            isWebSearchResult
              ? "bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/50"
              : "bg-muted/20 dark:bg-muted/30 border-border/20 dark:border-border/30"
          )}
        >
          <summary className={cn(
            "font-semibold cursor-pointer text-sm hover:opacity-80",
            isWebSearchResult
              ? "text-blue-700 dark:text-blue-300"
              : "text-foreground/80 dark:text-foreground/90"
            )}
          >
            {title}
          </summary>
          <div className="mt-2 text-xs prose-sm dark:prose-invert max-w-none prose-p:text-foreground/90 prose-li:text-foreground/90 prose-a:text-accent hover:prose-a:text-accent/80">
            {renderText(content)}
          </div>
        </details>
      );
    }

    return part.split(markdownElementsRegex).filter(Boolean).map((subPart, subIndex) => {
      const key = `part-${index}-sub-${subIndex}`;
      if (subPart === '\n') {
        return <br key={key} />;
      }
      if (subPart.startsWith('**') && subPart.endsWith('**')) {
        return <strong key={key}>{subPart.substring(2, subPart.length - 2)}</strong>;
      }
      if (subPart.startsWith('*') && subPart.endsWith('*')) {
        return <em key={key}>{subPart.substring(1, subPart.length - 1)}</em>;
      }
      if (subPart.startsWith('```') && subPart.endsWith('```')) {
        return <pre key={key} className="bg-muted/50 p-2 rounded-md my-1 text-sm overflow-x-auto"><code>{subPart.substring(3, subPart.length - 3)}</code></pre>;
      }
      if (subPart.startsWith('`') && subPart.endsWith('`')) {
        return <code key={key} className="bg-muted/50 px-1 py-0.5 rounded text-sm">{subPart.substring(1, subPart.length - 1)}</code>;
      }
      return <span key={key}>{subPart}</span>;
    });
  });
};

interface ChatMessageItemProps {
  message: Message;
  userAvatarUri?: string; // Added userAvatarUri prop
}

export function ChatMessageItem({ message, userAvatarUri }: ChatMessageItemProps) {
  const isUser = message.sender === "user";
  const isSystem = message.sender === "system";

  const getAvatarIcon = () => {
    // For user, AvatarImage will be used if userAvatarUri exists, so this is fallback
    if (isUser) return <User className="h-6 w-6" />; 
    if (message.sender === "ai") {
      if (message.type === "error") return <AlertTriangle className="h-6 w-6 text-destructive" />;
      if (message.type === "summary") return <FileText className="h-6 w-6 text-secondary" />;
      if (message.type === "search_result") return <Search className="h-6 w-6 text-accent" />;
      return <Bot className="h-6 w-6 text-primary" />;
    }
    return <CheckCircle className="h-6 w-6 text-green-500" />; 
  };
  
  if (isSystem) {
    return (
      <div className="flex justify-center items-center my-2">
        <p className="text-xs text-muted-foreground italic px-4 py-1 bg-muted/30 rounded-full shadow-sm">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 my-3 md:my-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-primary/50 shadow-md flex-shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-secondary/30 text-primary">
            {getAvatarIcon()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col gap-1.5 max-w-[70%] md:max-w-[65%]", isUser ? "items-end" : "items-start")}>
        {message.sender === 'ai' && message.reasoning && (
          <Card className="w-full rounded-lg shadow-md bg-muted/30 border-border/20">
            <CardHeader className="p-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <BrainCog className="h-4 w-4 text-primary/70" />
                Reasoning (thought for {message.duration?.toFixed(1) ?? '?'}s)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <p className="text-xs italic text-muted-foreground/80 whitespace-pre-wrap">
                {message.reasoning}
              </p>
            </CardContent>
          </Card>
        )}
        <Card
          className={cn(
            "w-fit rounded-xl shadow-lg", 
            isUser
              ? "bg-primary/80 text-primary-foreground rounded-br-none glassmorphic"
              : "bg-card/80 text-card-foreground rounded-bl-none glassmorphic",
            message.type === "error" ? "border-destructive/50 bg-destructive/20" : "border-border/30"
          )}
          style={isUser ? {boxShadow: '0 0 10px hsl(var(--primary)/0.3), 0 0 20px hsl(var(--primary)/0.2)'} : {boxShadow: '0 0 10px hsl(var(--card-foreground)/0.1)'}}
        >
          <CardContent className="p-3 text-sm md:text-base leading-relaxed break-words">
            {message.fileName && (
              <p className="text-xs font-medium mb-1 opacity-80">
                {isUser ? `You uploaded: ${message.fileName}` : `Regarding: ${message.fileName}`}
              </p>
            )}
            {message.filePreviewUri && message.type !== 'file_upload_request' && (
               <div className="my-2">
                  <Image 
                      src={message.filePreviewUri} 
                      alt={message.fileName || "Uploaded image"} 
                      width={200} 
                      height={200} 
                      className="rounded-md object-cover max-h-48 w-auto border border-border/50"
                      data-ai-hint="abstract data"
                  />
              </div>
            )}
            <div className="whitespace-pre-wrap">{renderText(message.text)}</div>
            <p className={cn("text-xs mt-2 opacity-70", isUser ? "text-right" : "text-left")}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </CardContent>
        </Card>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-accent/50 shadow-md flex-shrink-0">
          {userAvatarUri ? (
            <AvatarImage src={userAvatarUri} alt="User Avatar" />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-accent/30 to-secondary/30 text-accent">
            {getAvatarIcon()} 
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

