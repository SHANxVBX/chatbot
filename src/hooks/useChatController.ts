
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
    text: "Welcome to CyberChat AI, created by Shan! How can I assist you in the digital realm today? 🤖✨",
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
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) { 
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
      setMessages(getDefaultWelcomeMessage());
    }
  }, [getDefaultWelcomeMessage]);


  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0 && !(messages.length === 1 && messages[0].id.startsWith('ai-welcome'))) {
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
      if (prevMessages.length === 1 && prevMessages[0].id.startsWith('ai-welcome-')) {
        // Replace welcome message if user sends a message and it's the only one
        if (sender === 'user' && newMessage.text.trim() !== "") { 
             return [newMessage];
        }
         // Otherwise, if it's an AI message or an empty user message, append
        return [...prevMessages, newMessage]; 
      }
      return [...prevMessages, newMessage];
    });
    return newMessage.id;
  }, []);
  
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? {...msg, ...updates, timestamp: Date.now()} : msg));
  }, []);

  const streamMessageUpdate = useCallback((id: string, chunk: string) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === id) {
          const isInitialPlaceholder = msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching");
          const updatedText = isInitialPlaceholder ? chunk : (msg.text || "") + chunk; 
          return { ...msg, text: updatedText, timestamp: Date.now() };
        }
        return msg;
      });
    });
  }, []);

  const handleSendMessage = async (text: string, file?: { dataUri: string; name: string; type: string }) => {
    const userMessageText = text || (file ? `Attached: ${file.name}`: "");
    if (!userMessageText.trim() && !file) return; 

    addMessage(userMessageText, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
    setIsLoading(true);
    
    const startTime = Date.now();
    // Add a placeholder AI message, which will be updated by the stream
    const aiMessageId = addMessage("Thinking...", "ai", "text");
    setCurrentAIMessageId(aiMessageId);

    if (!settings.apiKey || settings.apiKey.trim() === "") {
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      updateMessage(aiMessageId, {
        text: "API key not set. Please configure your OpenRouter API key in the AI Provider Settings (sidebar).",
        type: "error",
        reasoning: "API key check failed: The API key is missing from the settings. AI communication cannot proceed without a valid API key.",
        duration: durationInSeconds,
      });
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
    let accumulatedText = ""; // To store the full response text for final update

    try {
      // Filter out system messages and the current placeholder AI message from history
      const apiMessageHistory = messages
        .filter(msg => {
            if (msg.sender === 'system') return false;
            // Don't include the initial welcome message if it's the only message and we're about to replace it
            if (msg.id.startsWith('ai-welcome-') && messages.length === 1 && messages[0].id === msg.id) return false; 
            // Don't include the current placeholder "Thinking..." message
            if (msg.id === aiMessageId && (msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching"))) return false;
            return true; 
        })
        .slice(-10) // Keep last 10 relevant messages for context
        .map(msg => {
          const role = msg.sender === 'user' ? 'user' : 'assistant';
          let content: any = msg.text;

          // Handle user messages with image files for multimodal models
          if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
            content = [{ type: 'text', text: msg.text || "Image attached" }];
            content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
          } else if (msg.sender === 'user' && msg.fileDataUri && !msg.filePreviewUri?.startsWith('data:image')) {
            // For non-image files, describe the upload in text
            content = `User uploaded a file: ${msg.fileName}. User's message: ${msg.text}`;
          }
          return { role, content };
        });
      
      // Prepare the current user message for the API
      const currentUserMessageForAPI: any = { role: 'user', content: text };
      if (file && file.type.startsWith("image/")) { // Multimodal image handling
          currentUserMessageForAPI.content = [
              { type: 'text', text: text || "Image attached"}, // Ensure text is always present
              { type: 'image_url', image_url: { url: file.dataUri } }
          ];
      } else if (file) { // Non-image file handling
          currentUserMessageForAPI.content = `User uploaded a file: ${file.name}. User's message: ${text}`;
      }

      const payload = {
        model: settings.model,
        messages: [
          { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant created by Shan. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, code blocks, etc.). Incorporate friendly emojis where appropriate in your final answer, but not in the reasoning part." },
          ...apiMessageHistory,
          currentUserMessageForAPI 
        ],
        stream: true,
        // OpenRouter specific headers, if needed (siteUrl/appTitle are common)
        // route: "api/v1/chat/completions", // Not typically needed directly in payload
        // user: `user-${Date.now()}` // Example user ID if your provider supports it
        http_referer: APP_SITE_URL, // OpenRouter specific header
        x_title: APP_TITLE,      // OpenRouter specific header
      };

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
           // OpenRouter specific headers (already in payload for some models, but good practice for proxy/gateway)
          "HTTP-Referer": APP_SITE_URL, 
          "X-Title": APP_TITLE,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error. Check API key, model selection, or network." }}));
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
          break; 
        }

        buffer += decoder.decode(value, { stream: true });
        // SSE format: data: {...}\n\n
        const eventSeparator = "\n\n";
        let eventEndIndex;
        while ((eventEndIndex = buffer.indexOf(eventSeparator)) !== -1) {
            const eventPart = buffer.substring(0, eventEndIndex);
            buffer = buffer.substring(eventEndIndex + eventSeparator.length);

            if (eventPart.startsWith("data: ")) {
                const jsonData = eventPart.substring(6).trim();
                if (jsonData === "[DONE]") {
                    if (reader) await reader.cancel(); 
                    reader = null;
                    // Final update handled in finally or after loop
                    break; // Exit while loop for parts
                }
                try {
                    const chunkData = JSON.parse(jsonData);
                    if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                        const contentChunk = chunkData.choices[0].delta.content;
                        streamMessageUpdate(aiMessageId, contentChunk);
                        accumulatedText += contentChunk;
                    } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                        if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') { 
                            if (reader) await reader.cancel();
                            reader = null;
                            break; // Exit while loop for parts
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream JSON:", jsonData, e);
                     // Update with error, but let finally handle main cleanup
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
                        ...msg,
                        text: `Error: Stream parsing error. ${(e as Error).message}. Data: ${jsonData.substring(0,100)}...`,
                        type: "error"
                    } : msg));
                }
            }
        }
        if (reader === null) break; // Exit outer while if [DONE] or finish_reason processed
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      const errorMsg = (error as Error).message || "Failed to connect to AI or process its response. Check console.";
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      updateMessage(aiMessageId, { 
        text: `Error: ${errorMsg}`, 
        type: "error",
        reasoning: `An error occurred while attempting to communicate with or process the response from the AI service: ${errorMsg}`,
        duration: durationInSeconds,
      });
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
      
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      const placeholderReasoning = "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.";

      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === aiMessageId) {
            let finalText = accumulatedText || msg.text; // Use accumulated if available, else current text
            let finalType = msg.type || 'text';
            let finalReasoning = msg.reasoning || placeholderReasoning;

            if (finalText === "Thinking..." || finalText.startsWith("Processing") || finalText.startsWith("Searching")) {
                 finalText = (msg.type === 'error' && msg.text !== "Thinking...") ? msg.text : "No response generated or an issue occurred. Please check the API key and model settings.";
                 if (msg.type !== 'error') finalType = 'error'; // Mark as error if it resolved to this
                 finalReasoning = msg.reasoning || "The AI service did not return a valid response. This could be due to network issues, incorrect API configuration, or problems with the AI model itself.";
            }
            
            return {
              ...msg,
              text: finalText, 
              reasoning: finalReasoning,
              duration: durationInSeconds,
              type: finalType
            };
          }
          return msg;
        });
      });
      
      setIsLoading(false);
      setCurrentAIMessageId(null); 
    }
  };

  const handleFileUpload = async (fileDataUri: string, fileName: string, fileType: string) => {
    addMessage(`Processing ${fileName} for summarization...`, "system", "text");
    setIsLoading(true);
    const startTime = Date.now();
    const aiMessageId = addMessage(`Processing document "${fileName}"...`, "ai", "summary");
    setCurrentAIMessageId(aiMessageId);

    try {
      const result = await summarizeUpload({ fileDataUri });
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      const reasoning = "The AI analyzed the uploaded document, identified key information, and generated a concise summary based on its content understanding capabilities. This involved extracting main points and rephrasing them succinctly.";
      updateMessage(aiMessageId, { 
        text: `Summary for ${fileName}:\n${result.summary}`, 
        type: "summary",
        reasoning: reasoning,
        duration: durationInSeconds,
        fileName: fileName,
      });
      toast({
        title: "Summary Complete",
        description: `${fileName} has been summarized.`,
      });
    } catch (error) {
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      const reasoning = `An error occurred during the document summarization process for "${fileName}". This could be due to an issue with the Genkit flow, the AI model's ability to process the document format, or the file content itself. Specific error: ${(error as Error).message}`;
      console.error("Error summarizing file:", error);
      updateMessage(aiMessageId, {
        text: `Error summarizing ${fileName}: ${(error as Error).message || 'Unknown error'}. The AI core might be offline or the file format is not supported.`, 
        type: "error",
        reasoning: reasoning,
        duration: durationInSeconds,
        fileName: fileName,
      });
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
    const startTime = Date.now();
    const aiMessageId = addMessage(`Searching the web for "${query}"...`, "ai", "search_result");
    setCurrentAIMessageId(aiMessageId);

    try {
      const result = await smartWebSearch({ query });
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      const reasoning = `The AI initiated a web search for "${query}", retrieved relevant snippets from search results using an external API, and then synthesized this information into a coherent summary.`;
      updateMessage(aiMessageId, {
        text: `Web search results for "${query}":\n${result.summary}`, 
        type: "search_result",
        reasoning: reasoning,
        duration: durationInSeconds
      });
      toast({
        title: "Web Search Complete",
        description: `Found information for "${query}".`,
      });
    } catch (error) {
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      const baseErrorMessage = (error as Error).message || 'Unknown error';
      let displayedErrorMessage = `Error searching web for "${query}": ${baseErrorMessage}`;
      let finalReasoning;

      const specificApiKeyErrorText = 'The environment variable SERPAPI_API_KEY must be set to use web search.';

      if (baseErrorMessage.trim() === specificApiKeyErrorText.trim()) {
        // For the specific API key error, ensure it ends with a period if it doesn't already.
        if (!baseErrorMessage.endsWith('.')) {
            displayedErrorMessage = `Error searching web for "${query}": ${baseErrorMessage}.`;
        }
        finalReasoning = `Web search functionality requires a SERPAPI_API_KEY. This key was not found in the environment variables, preventing the search.`;
      } else {
        // If it's not the specific API key error, append the generic part.
        if (!baseErrorMessage.endsWith('.')) {
            displayedErrorMessage += '.';
        }
        displayedErrorMessage += ' Data streams might be corrupted or the search module is offline.';
        finalReasoning = `An error occurred while performing the web search for "${query}". The specific error was: "${baseErrorMessage}". This could be due to issues with the search API, network connectivity, or the summarization model.`;
      }
      
      updateMessage(aiMessageId, {
        text: displayedErrorMessage, 
        type: "error",
        reasoning: finalReasoning,
        duration: durationInSeconds
      });
      toast({
        title: "Web Search Failed",
        description: baseErrorMessage, // Show the core error in toast
        variant: "destructive",
      });
    } finally {
      setIsSearchingWeb(false);
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };
  
  const clearChat = () => {
    setMessages(getDefaultWelcomeMessage()); 
    if (typeof window !== "undefined") {
        localStorage.removeItem(CHAT_STORAGE_KEY);
    }
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


    