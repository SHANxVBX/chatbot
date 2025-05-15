
"use client"; 

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { useChatController } from "@/hooks/useChatController";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function AppLayout() {
  const {
    messages,
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  } = useChatController();

  const chatHistory = [
    // { id: "chat1", name: "Project Genesis Log" },
    // { id: "chat2", name: "System Diagnostic" },
  ];
  const handleSelectChat = (id: string) => {
    console.log("Selected chat:", id);
  };

  const isChatEmptyForClearing = messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('ai-welcome-'));

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-muted/30">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar
            onFileUpload={handleFileUpload}
            onWebSearch={handleWebSearch}
            isSearchingWeb={isSearchingWeb}
            chatHistory={chatHistory}
            onSelectChat={handleSelectChat}
          />
          <main className="flex flex-1 flex-col overflow-hidden bg-background/50 md:m-2 md:rounded-xl md:shadow-2xl md:border md:border-border/20 glassmorphic">
            <div className="p-2 border-b border-border/20 flex justify-end items-center">
              <Button
                onClick={clearChat}
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90"
                disabled={isLoading || isChatEmptyForClearing}
                aria-label="Clear chat history"
              >
                <Trash2 className="mr-0 md:mr-2 h-4 w-4" />
                <span className="hidden md:inline">Clear Chat</span>
              </Button>
            </div>
            <ChatMessageList messages={messages} isLoading={isLoading} currentAIMessageId={currentAIMessageId} />
            <ChatInputBar onSendMessage={handleSendMessage} isLoading={isLoading} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
