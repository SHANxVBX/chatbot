
"use client";

import type { Message } from "@/lib/types";
import { ChatMessageItem } from "./ChatMessageItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import { Bot, MessageSquareDashed } from "lucide-react";

interface ChatMessageListProps {
  messages: Message[];
  isLoading?: boolean;
  currentAIMessageId?: string | null;
  userAvatarUri?: string; // Added userAvatarUri prop
}

export function ChatMessageList({ messages, isLoading, currentAIMessageId, userAvatarUri }: ChatMessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading, currentAIMessageId]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 bg-background/30 rounded-lg m-2 sm:m-3 md:m-4 border border-dashed border-border/50">
        <MessageSquareDashed className="h-12 w-12 sm:h-16 sm:w-16 text-primary/50 mb-3 sm:mb-4" />
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1 sm:mb-2">Start Your Cyber-Dialogue</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-sm sm:max-w-md">
          Type your query or command below, upload a document, or initiate a web search using the tools in the sidebar. The AI awaits your transmission.
        </p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollAreaRef} viewportRef={viewportRef}>
      <div className="space-y-4">
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} userAvatarUri={userAvatarUri} /> // Pass userAvatarUri
        ))}
        {isLoading && !currentAIMessageId && (
           <div className="flex justify-start items-start gap-3 my-3 md:my-4">
             <Bot className="h-8 w-8 md:h-10 md:w-10 text-primary flex-shrink-0 p-1.5 border-2 border-primary/50 rounded-full shadow-md bg-gradient-to-br from-primary/30 to-secondary/30" />
             <div className="max-w-[70%] md:max-w-[65%] rounded-xl shadow-lg bg-card/80 text-card-foreground rounded-bl-none glassmorphic p-3">
                <div className="flex space-x-1 animate-pulse">
                    <div className="w-2 h-2 bg-primary/70 rounded-full"></div>
                    <div className="w-2 h-2 bg-primary/70 rounded-full animation-delay-200"></div>
                    <div className="w-2 h-2 bg-primary/70 rounded-full animation-delay-400"></div>
                </div>
             </div>
           </div>
        )}
      </div>
    </ScrollArea>
  );
}

