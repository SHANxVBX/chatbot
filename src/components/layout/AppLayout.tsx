
"use client"; // Make this a client component to manage state via useChatController

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { useChatController } from "@/hooks/useChatController";
import { Card } from "@/components/ui/card";

export function AppLayout() {
  const {
    messages,
    settings,
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    isCreatorModeActive,
    setSettings,
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  } = useChatController();

  // Placeholder chat history and selection logic
  const chatHistory = [
    // { id: "chat1", name: "Project Genesis Log" },
    // { id: "chat2", name: "System Diagnostic" },
  ];
  const handleSelectChat = (id: string) => {
    console.log("Selected chat:", id);
    // Logic to load selected chat
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-muted/30">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden"> {/* This div handles overflow for content below header */}
          <AppSidebar
            settings={settings}
            onSettingsChange={setSettings}
            onFileUpload={handleFileUpload}
            onWebSearch={handleWebSearch}
            isSearchingWeb={isSearchingWeb}
            chatHistory={chatHistory}
            onSelectChat={handleSelectChat}
          />
          <main className="flex flex-1 flex-col overflow-hidden bg-background/50 md:m-2 md:rounded-xl md:shadow-2xl md:border md:border-border/20 glassmorphic">
            <ChatMessageList messages={messages} isLoading={isLoading} currentAIMessageId={currentAIMessageId} />
            <ChatInputBar onSendMessage={handleSendMessage} isLoading={isLoading} onClearChat={clearChat} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

