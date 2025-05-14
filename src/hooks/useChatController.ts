"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, AISettings, MessageSender } from "@/lib/types";
import { summarizeUpload } from "@/ai/flows/summarize-upload";
import { smartWebSearch } from "@/ai/flows/smart-web-search";
import { useToast } from "@/hooks/use-toast";

const CHAT_STORAGE_KEY = "cyberchat-ai-history";
const SETTINGS_STORAGE_KEY = "cyberchat-ai-settings";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_SITE_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:9002"; // Default for server-side if needed
const APP_TITLE = "CyberChat AI";


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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages);
          if (Array.isArray(parsedMessages)) {
            setMessages(parsedMessages);
          } else {
            setMessages(getDefaultWelcomeMessage());
          }
        } catch (e) {
          console.error("Failed to parse messages from localStorage", e);
          setMessages(getDefaultWelcomeMessage());
        }
      } else {
        setMessages(getDefaultWelcomeMessage());
      }
    }
  }, []);

  const getDefaultWelcomeMessage = (): Message[] => [{
    id: `ai-welcome-${Date.now()}`,
    text: "Welcome to CyberChat AI! How can I assist you in the digital realm today?",
    sender: 'ai',
    timestamp: Date.now(),
    type: 'text',
  }];


  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) { // Avoid saving empty initial array before hydration
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

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
          const isInitialPlaceholder = msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching");
          const updatedText = isInitialPlaceholder ? chunk : msg.text + chunk;
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

    if (!settings.apiKey || settings.apiKey.trim() === "") {
      updateMessage(aiMessageId, "API key not set. Please configure your OpenRouter API key in the AI Provider Settings (sidebar).", "error");
      toast({
        title: "API Key Missing",
        description: "Configure your OpenRouter API key in settings.",
        variant: "destructive",
      });
      setIsLoading(false);
      setCurrentAIMessageId(null);
      return;
    }

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const messageHistoryForAPI = messages
        .filter(msg => {
          if (msg.sender === 'system') return false;
          // Exclude AI thinking/processing placeholders associated with the current response being generated
          if (msg.id === aiMessageId && (msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching"))) return false;
          
          // Include relevant user messages and AI responses (text, summary, search_result, error for context)
          if (msg.sender === 'user' && (msg.type === 'text' || msg.type === 'file_upload_request')) return true;
          if (msg.sender === 'ai' && (msg.type === 'text' || msg.type === 'summary' || msg.type === 'search_result' || msg.type === 'error')) return true;
          return false;
        })
        .slice(-12) // Use a slightly larger history, e.g., 12 items (6 pairs)
        .map(msg => {
          const role = msg.sender === 'user' ? 'user' : 'assistant';
          if (role === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: msg.text || "Image attached" }, // Ensure text is not empty
                { type: 'image_url', image_url: { url: msg.fileDataUri } },
              ],
            };
          }
          return { role, content: msg.text };
        });
        
      const payload = {
        model: settings.model,
        messages: [
          { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, lists, etc.)." },
          ...messageHistoryForAPI,
        ],
        stream: true,
      };

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": APP_SITE_URL,
          "X-Title": APP_TITLE,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error occurred." }}));
        const errorMessage = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Response body is null. Cannot process stream.");
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            console.warn("Stream ended with unprocessed buffer:", buffer);
            // Potentially process final part of buffer if needed, though rare for SSE
          }
          streamMessageUpdate(aiMessageId, "", true); // Signal completion
          break; // Exit while loop
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // Keep incomplete part in buffer

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonData = part.substring(6).trim();
            if (jsonData === "[DONE]") {
              streamMessageUpdate(aiMessageId, "", true); // Signal completion
              if (reader) await reader.cancel(); // Cancel reader instead of just releasing lock
              reader = null;
              setIsLoading(false); // Set explicitly on clean exit
              setCurrentAIMessageId(null); // Set explicitly on clean exit
              return; // Exit handleSendMessage
            }
            try {
              const chunkData = JSON.parse(jsonData);
              if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                const contentChunk = chunkData.choices[0].delta.content;
                streamMessageUpdate(aiMessageId, contentChunk);
              } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                if(chunkData.choices[0].finish_reason === 'stop') {
                    streamMessageUpdate(aiMessageId, "", true);
                    if (reader) await reader.cancel();
                    reader = null;
                    setIsLoading(false); // Set explicitly on clean exit
                    setCurrentAIMessageId(null); // Set explicitly on clean exit
                    return; // Exit handleSendMessage
                }
              }
            } catch (e) {
              console.error("Error parsing stream JSON:", jsonData, e);
              // This error is critical for stream processing. Re-throw to be caught by outer try-catch.
              throw new Error(`Stream parsing error: ${(e as Error).message}. Data: ${jsonData}`);
            }
          }
        }
      }
      // If loop finished due to `done` without an explicit [DONE] or 'stop' signal from above returns
      streamMessageUpdate(aiMessageId, "", true);

    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      const errorMsg = (error as Error).message || "Failed to connect to AI or process its response. Check console.";
      updateMessage(aiMessageId, `Error: ${errorMsg}`, "error");
      toast({
        title: "AI Communication Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      if (reader) {
        try {
          await reader.cancel(); // Ensure reader is cancelled if loop exited unexpectedly
        } catch (e) {
          console.error("Error cancelling reader:", e);
        }
      }
      setIsLoading(false);
      setCurrentAIMessageId(null); // Ensure this is always reset if not already
    }
  };

  const handleFileUpload = async (fileDataUri: string, fileName: string, fileType: string) => {
    addMessage(`Processing ${fileName} for summarization...`, "system", "text");
    setIsLoading(true);
    const aiMessageId = addMessage(`Processing document "${fileName}"...`, "ai", "summary");
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
      updateMessage(aiMessageId, `Error summarizing ${fileName}: ${(error as Error).message || 'Unknown error'}. The AI core might be offline or the file format is not supported.`, "error");
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
    addMessage(`Initiating web search for: "${query}"`, "user", "text");
    setIsSearchingWeb(true); // Specific loading state for search
    setIsLoading(true); 
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
      updateMessage(aiMessageId, `Error searching web for "${query}": ${(error as Error).message || 'Unknown error'}. Data streams might be corrupted or the search module is offline.`, "error");
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
    // addMessage, // Not typically exposed directly if all additions go through handlers
    // updateMessage, // Same as addMessage
    // streamMessageUpdate, // Internal helper
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  };
}
