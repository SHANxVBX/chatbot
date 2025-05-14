"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, AISettings, MessageSender } from "@/lib/types";
import { summarizeUpload } from "@/ai/flows/summarize-upload";
import { smartWebSearch } from "@/ai/flows/smart-web-search";
import { useToast } from "@/hooks/use-toast";

const CHAT_STORAGE_KEY = "cyberchat-ai-history";
const SETTINGS_STORAGE_KEY = "cyberchat-ai-settings";

export function useChatController() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIMessageId, setCurrentAIMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useState<AISettings>(() => {
    if (typeof window !== "undefined") {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return storedSettings
        ? JSON.parse(storedSettings)
        : { apiKey: "", model: "openai/gpt-4o", provider: "OpenRouter" };
    }
    return { apiKey: "", model: "openai/gpt-4o", provider: "OpenRouter" };
  });

  // Load chat history from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      } else {
         // Add an initial welcome message if history is empty
        setMessages([{
          id: `ai-welcome-${Date.now()}`,
          text: "Welcome to CyberChat AI! How can I assist you in the digital realm today?",
          sender: 'ai',
          timestamp: Date.now(),
          type: 'text',
        }]);
      }
    }
  }, []);

  // Save chat history to local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Save settings to local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings]);

  const addMessage = useCallback((text: string, sender: MessageSender, type?: Message['type'], fileName?: string, filePreviewUri?: string, fileDataUri?: string) => {
    const newMessage: Message = {
      id: `${sender}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      sender,
      timestamp: Date.now(),
      type: type || 'text',
      fileName,
      filePreviewUri,
      fileDataUri,
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    return newMessage.id;
  }, []);
  
  const updateMessage = useCallback((id: string, newText: string, newType?: Message['type']) => {
    setMessages(prev => prev.map(msg => msg.id === id ? {...msg, text: newText, type: newType || msg.type, timestamp: Date.now()} : msg));
  }, []);

  const streamMessageUpdate = useCallback((id: string, chunk: string, isFinal: boolean = false) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === id) {
          const updatedText = msg.text === "Thinking..." || msg.text === "Searching..." ? chunk : msg.text + chunk;
          return { ...msg, text: updatedText, timestamp: Date.now() };
        }
        return msg;
      });
    });
    if (isFinal) {
      setCurrentAIMessageId(null);
    }
  }, []);

  const handleSendMessage = async (text: string, file?: { dataUri: string; name: string; type: string }) => {
    addMessage(text, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
    setIsLoading(true);
    
    const aiMessageId = addMessage("Thinking...", "ai", "text");
    setCurrentAIMessageId(aiMessageId);

    try {
      // This is a placeholder for actual LLM interaction.
      // For now, we'll just echo or use a predefined response.
      // In a real scenario, you'd call your chosen LLM API here with `text` and `settings`.
      // The Genkit flows are for specific tasks (summarize, web search).
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let aiResponseText = `Cyber-echo: "${text}"`;
      if (text.toLowerCase().includes("hello") || text.toLowerCase().includes("hi")) {
        aiResponseText = "Greetings, user. Systems online. How may I assist?";
      } else if (text.toLowerCase().includes("help")) {
        aiResponseText = "I can assist with text-based queries, summarize uploaded documents, or perform web searches. Use the sidebar tools or type your request.";
      } else if (text.toLowerCase().includes("time")) {
        aiResponseText = `The current cyber-time is: ${new Date().toLocaleTimeString()}.`;
      }

      updateMessage(aiMessageId, aiResponseText);

    } catch (error) {
      console.error("Error sending message:", error);
      updateMessage(aiMessageId, "Error: Could not connect to AI. Check console.", "error");
      toast({
        title: "AI Connection Error",
        description: "Failed to get a response from the AI. Please check your settings or network.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };

  const handleFileUpload = async (fileDataUri: string, fileName: string, fileType: string) => {
    addMessage(`Attempting to summarize ${fileName}...`, "system", "text");
    setIsLoading(true);
    const aiMessageId = addMessage("Processing document...", "ai", "summary");
    setCurrentAIMessageId(aiMessageId);

    try {
      const result = await summarizeUpload({ fileDataUri });
      updateMessage(aiMessageId, `Summary for ${fileName}:\n${result.summary}`, "summary");
      toast({
        title: "Summary Complete",
        description: `${fileName} has been summarized.`,
      });
    } catch (error) {
      console.error("Error summarizing file:", error);
      updateMessage(aiMessageId, `Error summarizing ${fileName}. The AI core might be offline or the file format is not supported by the current model.`, "error");
      toast({
        title: "Summarization Failed",
        description: (error as Error).message || "Could not summarize the file.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };

  const handleWebSearch = async (query: string) => {
    addMessage(`Searching the web for: "${query}"`, "user", "text");
    setIsSearchingWeb(true);
    setIsLoading(true); // Generic loading state
    const aiMessageId = addMessage(`Searching the web for "${query}"...`, "ai", "search_result");
    setCurrentAIMessageId(aiMessageId);

    try {
      const result = await smartWebSearch({ query });
      updateMessage(aiMessageId, `Web search results for "${query}":\n${result.summary}`, "search_result");
      toast({
        title: "Web Search Complete",
        description: `Found information for "${query}".`,
      });
    } catch (error) {
      console.error("Error performing web search:", error);
      updateMessage(aiMessageId, `Error searching web for "${query}". The data streams might be corrupted or the search module is offline.`, "error");
      toast({
        title: "Web Search Failed",
        description: (error as Error).message || "Could not perform web search.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingWeb(false);
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };
  
  const clearChat = () => {
    setMessages([{
        id: `ai-cleared-${Date.now()}`,
        text: "Chat history cleared. Ready for a new transmission.",
        sender: 'ai',
        timestamp: Date.now(),
        type: 'text',
    }]);
    toast({ title: "Chat Cleared", description: "The conversation has been reset."});
  };


  return {
    messages,
    settings,
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    setSettings,
    addMessage,
    updateMessage,
    streamMessageUpdate,
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  };
}
