
"use client"; 

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { useChatController } from "@/hooks/useChatController";

export function AppLayout() {
  const {
    messages,
    // settings, // Settings are now managed on /settings page, but still accessible via hook
    // setSettings, // Setting settings will be done on /settings page
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    // isCheckingApiKey, // API key check is now part of /settings page
    // activeKeyIndexForCheck, // Part of /settings page
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
    // checkSingleApiKeyStatus, // This will be called from the /settings page
  } = useChatController();

  const chatHistory = [
    // { id: "chat1", name: "Project Genesis Log" },
    // { id: "chat2", name: "System Diagnostic" },
  ];
  const handleSelectChat = (id: string) => {
    console.log("Selected chat:", id);
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-muted/30">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar
            // settings={settings} // No longer pass settings directly to sidebar
            // onSettingsChange={setSettings} // No longer pass settings directly to sidebar
            onFileUpload={handleFileUpload}
            onWebSearch={handleWebSearch}
            isSearchingWeb={isSearchingWeb}
            chatHistory={chatHistory}
            onSelectChat={handleSelectChat}
            // onCheckSingleApiKeyStatus={checkSingleApiKeyStatus} // No longer needed here
            // isCheckingApiKey={isCheckingApiKey} // No longer needed here
            // activeKeyIndexForCheck={activeKeyIndexForCheck} // No longer needed here
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
