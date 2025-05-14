"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, AISettings, MessageSender } from "@/lib/types";
import { summarizeUpload } from "@/ai/flows/summarize-upload";
import { smartWebSearch } from "@/ai/flows/smart-web-search";
import { useToast } from "@/hooks/use-toast";

const CHAT_STORAGE_KEY = "cyberchat-ai-history";
const SETTINGS_STORAGE_KEY = "cyberchat-ai-settings";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_SITE_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:9002"; 
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
    // Default for server-side or if window is not defined
    return { apiKey: "", model: "openai/gpt-4o", provider: "OpenRouter" };
  });

  const getDefaultWelcomeMessage = useCallback((): Message[] => [{
    id: `ai-welcome-${Date.now()}`,
    text: "Welcome to CyberChat AI, created by Shan! How can I assist you in the digital realm today?",
    sender: 'ai',
    timestamp: Date.now(),
    type: 'text',
  }], []);


  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages);
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) { // Ensure it's a non-empty array
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
    } else {
      // If window is not defined (e.g. during SSR build time), initialize with welcome message.
      // This prevents an empty message list if localStorage access fails or is unavailable initially.
      setMessages(getDefaultWelcomeMessage());
    }
  }, [getDefaultWelcomeMessage]);


  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0 && !(messages.length === 1 && messages[0].id.startsWith('ai-welcome'))) {
      // Only save if messages are not just the initial welcome message, or if there are more messages.
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
    setMessages((prevMessages) => {
      // If the only message is the welcome message, replace it
      if (prevMessages.length === 1 && prevMessages[0].id.startsWith('ai-welcome-')) {
        if (sender === 'user' && newMessage.text.trim() !== "") { // ensure user message is not empty
             return [newMessage];
        }
        return [...prevMessages, newMessage]; // if AI adds a system message after welcome or for file processing
      }
      return [...prevMessages, newMessage];
    });
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
          const updatedText = isInitialPlaceholder ? chunk : (msg.text || "") + chunk; // Ensure msg.text is not null
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
    const userMessageText = text || (file ? `Attached: ${file.name}`: "");
    if (!userMessageText.trim() && !file) return; // Do not send empty messages

    addMessage(userMessageText, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
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
      // Prepare message history for the API
      const apiMessageHistory = messages
        .filter(msg => {
            // Exclude system messages and initial welcome if no user interaction yet
            if (msg.sender === 'system') return false;
            if (msg.id.startsWith('ai-welcome-') && messages.length === 1) return false; 
            // Exclude AI "thinking" placeholders for the current response
            if (msg.id === aiMessageId && (msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching"))) return false;
            return true; // Include all other relevant messages
        })
        .slice(-10) // Keep a concise history, e.g., last 10 messages
        .map(msg => {
          const role = msg.sender === 'user' ? 'user' : 'assistant';
          let content: any = msg.text;

          // Handle file uploads, especially images for multimodal models
          if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
            content = [{ type: 'text', text: msg.text || "Image attached" }];
            content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
          } else if (msg.sender === 'user' && msg.fileDataUri && !msg.filePreviewUri?.startsWith('data:image')) {
            // For non-image files, could prepend a note about the file
            content = `User uploaded a file: ${msg.fileName}. User's message: ${msg.text}`;
          }
          return { role, content };
        });
      
      // Add current user message to history for API
      const currentUserMessageForAPI: any = { role: 'user', content: text };
      if (file && file.type.startsWith("image/")) {
          currentUserMessageForAPI.content = [
              { type: 'text', text: text || "Image attached"},
              { type: 'image_url', image_url: { url: file.dataUri } }
          ];
      } else if (file) {
          currentUserMessageForAPI.content = `User uploaded a file: ${file.name}. User's message: ${text}`;
      }


      const payload = {
        model: settings.model,
        messages: [
          { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant created by Shan. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, lists, etc.)." },
          ...apiMessageHistory,
          currentUserMessageForAPI // Ensure the current message is part of the payload sent to API
        ],
        stream: true,
         // Optional: Add site URL and app title for OpenRouter moderation/tracking
        siteUrl: APP_SITE_URL,
        appTitle: APP_TITLE,
      };

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          // OpenRouter specific headers
          "HTTP-Referer": APP_SITE_URL, 
          "X-Title": APP_TITLE,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error occurred. Check network or API key." }}));
        const errorMessage = errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Response body is null. Cannot process stream.");
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstChunkReceived = false;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamMessageUpdate(aiMessageId, "", true); 
          break; 
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; 

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonData = part.substring(6).trim();
            if (jsonData === "[DONE]") {
              streamMessageUpdate(aiMessageId, "", true); 
              if (reader) await reader.cancel(); 
              reader = null;
              setIsLoading(false); 
              setCurrentAIMessageId(null); 
              return; 
            }
            try {
              const chunkData = JSON.parse(jsonData);
              if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                const contentChunk = chunkData.choices[0].delta.content;
                 if (!firstChunkReceived) {
                  // Replace "Thinking..." with the first actual content
                  updateMessage(aiMessageId, contentChunk);
                  firstChunkReceived = true;
                } else {
                  streamMessageUpdate(aiMessageId, contentChunk);
                }
              } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') { // also handle length finish reason
                    streamMessageUpdate(aiMessageId, "", true);
                    if (reader) await reader.cancel();
                    reader = null;
                    setIsLoading(false); 
                    setCurrentAIMessageId(null); 
                    return; 
                }
              }
            } catch (e) {
              console.error("Error parsing stream JSON:", jsonData, e);
              updateMessage(aiMessageId, `Error: Stream parsing error. ${(e as Error).message}. Data: ${jsonData.substring(0,100)}...`, "error");
              // Do not re-throw, try to continue if possible or let finally handle it
            }
          }
        }
      }
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
          await reader.cancel(); 
        } catch (e) {
          console.error("Error cancelling reader:", e);
        }
      }
      setIsLoading(false);
      setCurrentAIMessageId(null); 
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
    setIsSearchingWeb(true); 
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
    setMessages(getDefaultWelcomeMessage()); // Reset to welcome message
    toast({ title: "Chat Cleared", description: "The conversation has been reset."});
  };


  return {
    messages,
    settings,
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    setSettings,
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  };
}
