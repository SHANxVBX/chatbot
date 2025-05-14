
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

const uncertaintyPhrases = [
  "i don't know", "i'm not sure", "i am not sure", "i'm unsure", 
  "i can't recall", "i cannot recall", "i do not know", 
  "it's unclear to me", "i lack information", "i have no information"
];

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 
  'will', 'with', 'what', 'who', 'when', 'where', 'why', 'how', 'i', 'you', 
  'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'your', 'yours', 
  'yourself', 'yourselves', 'him', 'his', 'himself', 'she', 'her', 'hers', 
  'herself', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 
  'about', 'above', 'after', 'again', 'against', 'all', 'am', 'any', 'both', 
  'but', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 
  'during', 'each', 'few', 'further', 'had', 'having', 'here', 'into', 
  'just', 'more', 'most', 'no', 'nor', 'not', 'now', 'only', 'or', 'other', 
  'out', 'over', 'own', 'same', 'should', 'so', 'some', 'such', 'than', 
  'then', 'there', 'these', 'this', 'those', 'through', 'too', 'under', 
  'until', 'up', 'very', 'wasn\'t', 'weren\'t', 'won\'t', 'would'
]);

function refineSearchQuery(originalQuery: string, chatHistory: Message[]): string {
  let query = originalQuery.toLowerCase();
  
  // Remove stop words
  query = query.split(/\s+/).filter(word => !stopWords.has(word)).join(' ');

  // Add context from last 1-2 user messages if relevant
  const userMessages = chatHistory.filter(m => m.sender === 'user').slice(-3, -1); // Get 2nd and 3rd last user messages
  let context = "";
  if (userMessages.length > 0) {
    context = userMessages.map(m => m.text).join(" ");
    // Basic check to see if current query is a follow-up like "tell me more"
    if (query.length < 15 && (query.includes("more") || query.includes("about it") || query.includes("that"))) {
       const refinedContext = context.split(/\s+/).filter(word => !stopWords.has(word.toLowerCase())).join(' ');
       query = refinedContext + " " + query;
    }
  }
  
  return query.trim() || originalQuery; // Fallback to original query if refinement results in empty
}


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
        if (sender === 'user' && newMessage.text.trim() !== "") { 
             return [newMessage];
        }
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

    const userMessageId = addMessage(userMessageText, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
    setIsLoading(true);
    
    const startTime = Date.now();
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
    let accumulatedText = ""; 

    try {
      const apiMessageHistory = messages
        .filter(msg => {
            if (msg.sender === 'system') return false;
            if (msg.id.startsWith('ai-welcome-') && messages.length <= 2 && messages.some(m=>m.id.startsWith('ai-welcome-'))) return false;
            if (msg.id === aiMessageId && (msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching"))) return false;
            return true; 
        })
        .slice(-10)
        .map(msg => {
          const role = msg.sender === 'user' ? 'user' : 'assistant';
          let content: any = msg.text;
          if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
            content = [{ type: 'text', text: msg.text || "Image attached" }];
            content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
          } else if (msg.sender === 'user' && msg.fileDataUri && !msg.filePreviewUri?.startsWith('data:image')) {
            content = `User uploaded a file: ${msg.fileName}. User's message: ${msg.text}`;
          }
          return { role, content };
        });
      
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
          { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant created by Shan. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, code blocks, etc.). Incorporate friendly emojis where appropriate in your final answer, but not in the reasoning part." },
          ...apiMessageHistory,
          currentUserMessageForAPI 
        ],
        stream: true,
        http_referer: APP_SITE_URL,
        x_title: APP_TITLE,      
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
                    break; 
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
                            break;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream JSON:", jsonData, e);
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
                        ...msg,
                        text: `Error: Stream parsing error. ${(e as Error).message}. Data: ${jsonData.substring(0,100)}...`,
                        type: "error"
                    } : msg));
                }
            }
        }
        if (reader === null) break;
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
        try { await reader.cancel(); } catch (e) { console.error("Error cancelling reader:", e); }
      }
      
      let finalAiText = accumulatedText;
      const placeholderReasoning = "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.";

      // Check for uncertainty and trigger web search if needed
      const lowercasedAiText = finalAiText.toLowerCase();
      const isUncertain = uncertaintyPhrases.some(phrase => lowercasedAiText.includes(phrase));

      if (isUncertain && !file) { // Don't search web if it was a file upload context primarily
        const originalUserMessage = messages.find(m => m.id === userMessageId);
        const queryForSearch = refineSearchQuery(originalUserMessage?.text || text, messages);
        
        if (queryForSearch) {
          setIsSearchingWeb(true);
          updateMessage(aiMessageId, { text: `${finalAiText}\n\nSearching the web for more information...`, reasoning: placeholderReasoning });
          try {
            const searchFlowResult = await smartWebSearch({ query: queryForSearch });
            const searchResultsMarkdownContent = searchFlowResult.searchResultsMarkdown;
            const collapsibleWrapper = `\n\n:::collapsible Web Search Results\n${searchResultsMarkdownContent}\n:::`;
            finalAiText += collapsibleWrapper;
          } catch (searchError) {
            console.error("Error during web search enhancement:", searchError);
            finalAiText += `\n\nAn error occurred while trying to search the web: ${(searchError as Error).message}`;
          } finally {
            setIsSearchingWeb(false);
          }
        }
      }
      
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));

      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === aiMessageId) {
            let currentText = finalAiText || msg.text;
            let currentType = msg.type || 'text';
            let currentReasoning = msg.reasoning || placeholderReasoning;

            if (currentText === "Thinking..." || currentText.startsWith("Processing") || currentText.startsWith("Searching")) {
                 currentText = (msg.type === 'error' && msg.text !== "Thinking...") ? msg.text : "No response generated or an issue occurred. Please check the API key and model settings.";
                 if (msg.type !== 'error') currentType = 'error';
                 currentReasoning = msg.reasoning || "The AI service did not return a valid response. This could be due to network issues, incorrect API configuration, or problems with the AI model itself.";
            }
            
            return {
              ...msg,
              text: currentText, 
              reasoning: currentReasoning,
              duration: durationInSeconds,
              type: currentType
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
      const reasoning = `The AI initiated a web search for "${query}", retrieved relevant snippets from search results using an external API (DuckDuckGo), and then synthesized this information into a coherent summary.`;
      
      const collapsibleContent = result.searchResultsMarkdown;
      const fullText = `Web search results for "${query}":\n\n:::collapsible Web Search Results\n${collapsibleContent}\n:::`;

      updateMessage(aiMessageId, {
        text: fullText, 
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

      if (!baseErrorMessage.endsWith('.')) {
          displayedErrorMessage += '.';
      }
      displayedErrorMessage += ' Data streams might be corrupted or the search module is offline.';
      finalReasoning = `An error occurred while performing the web search for "${query}". The specific error was: "${baseErrorMessage}". This could be due to issues with the search API, network connectivity, or the formatting of results.`;
      
      updateMessage(aiMessageId, {
        text: displayedErrorMessage, 
        type: "error",
        reasoning: finalReasoning,
        duration: durationInSeconds
      });
      toast({
        title: "Web Search Failed",
        description: baseErrorMessage, 
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
