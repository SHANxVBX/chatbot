
"use client";

import type { AISettings } from "@/lib/types"; // AISettings might not be needed here anymore
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
// SettingsView is no longer directly used here
import { FileUploadView } from "@/components/sidebar/FileUploadView";
import { WebSearchView } from "@/components/sidebar/WebSearchView";
import { CyberLogoIcon } from "@/components/icons/CyberLogoIcon";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UploadCloud, Globe, History, ChevronRight } from 'lucide-react'; // Removed Cog
import { useAuth } from "@/hooks/useAuth";

interface AppSidebarProps {
  // Props related to settings might be removed or changed if settings are fully managed on /settings page
  // settings: AISettings; 
  // onSettingsChange: (newSettings: AISettings) => void;
  onFileUpload: (fileDataUri: string, fileName: string, fileType: string) => void;
  onWebSearch: (query: string) => void;
  isSearchingWeb: boolean;
  chatHistory: { id: string, name: string }[]; 
  onSelectChat: (id: string) => void;
  // Props for API key checking might also be only relevant on the /settings page
  // onCheckSingleApiKeyStatus: (apiKey: string, keyIndex: number) => void;
  // isCheckingApiKey: boolean;
  // activeKeyIndexForCheck: number | null;
}

export function AppSidebar({
  onFileUpload,
  onWebSearch,
  isSearchingWeb,
  chatHistory = [],
  onSelectChat,
}: AppSidebarProps) {
  const { isCreatorLoggedIn } = useAuth(); 

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="glassmorphic-sidebar border-r-0 md:border-r">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <CyberLogoIcon className="h-7 w-7 text-primary flex-shrink-0" />
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden tracking-tight" style={{ textShadow: '0 0 3px hsl(var(--primary)/0.5)'}}>
            CyberConsole
          </span>
        </div>
      </SidebarHeader>
      
      <ScrollArea className="flex-1">
        <SidebarContent className="p-0">
           <Accordion type="multiple" defaultValue={['ai-tools']} className="w-full">
            <AccordionItem value="ai-tools" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-sidebar-accent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2">
                <div className="flex items-center gap-2">
                   <ChevronRight className="h-4 w-4 text-primary transition-transform duration-200 group-data-[state=open]:rotate-90 group-data-[collapsible=icon]:hidden" />
                   <span className="group-data-[collapsible=icon]:hidden">AI Tools</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2 group-data-[collapsible=icon]:hidden">
                <div className="space-y-2 px-2">
                  <FileUploadView onFileUpload={onFileUpload} />
                  {isCreatorLoggedIn && ( 
                    <WebSearchView onWebSearch={onWebSearch} isSearching={isSearchingWeb} />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Settings AccordionItem Removed */}

            {chatHistory.length > 0 && (
              <AccordionItem value="history" className="border-b-0">
                 <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-sidebar-accent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2">
                   <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                      <span className="group-data-[collapsible=icon]:hidden">Chat History</span>
                   </div>
                 </AccordionTrigger>
                <AccordionContent className="pt-0 pb-2 group-data-[collapsible=icon]:hidden">
                  <SidebarMenu className="px-2">
                    {chatHistory.map(chat => (
                      <SidebarMenuItem key={chat.id}>
                        <SidebarMenuButton 
                          variant="ghost" 
                          size="sm" 
                          className="w-full justify-start"
                          onClick={() => onSelectChat(chat.id)}
                          tooltip={chat.name}
                        >
                          <span className="truncate">{chat.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </SidebarContent>
      </ScrollArea>
      
      <SidebarFooter className="p-4 mt-auto border-t border-sidebar-border/50 group-data-[collapsible=icon]:hidden">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} CyberChat AI
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
