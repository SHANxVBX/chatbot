
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
  "i don't know", "i'm not sure", "i am not sure", "i'm unsure", "unsure",
  "i can't recall", "i cannot recall", "i do not know", "don't know",
  "it's unclear to me", "i lack information", "i have no information",
  "i'm not certain", "uncertain", "no idea", "haven't a clue"
];

// Minimal stop words for client-side query refinement, more extensive list in smart-web-search flow
const clientStopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were']);

function refineSearchQueryForContext(originalQuery: string, chatHistory: Message[]): string {
  let query = originalQuery.toLowerCase();
  
  // Basic removal of client-side stop words
  query = query.split(/\s+/).filter(word => !clientStopWords.has(word)).join(' ');

  // Add context from last 1-2 user messages if relevant
  // Get the most recent user messages that are not the current one being processed
  const relevantHistory = chatHistory.filter(m => m.sender === 'user' && m.text.toLowerCase() !== originalQuery.toLowerCase()).slice(-2);
  
  let contextKeywords = "";
  if (relevantHistory.length > 0) {
    contextKeywords = relevantHistory.map(m => m.text.toLowerCase().split(/\s+/).filter(word => !clientStopWords.has(word) && word.length > 2).join(" ")).join(" ");
  }
  
  // If current query is very short and seems like a follow-up, prepend context.
  if (query.split(/\s+/).length <= 3 && (query.includes("more") || query.includes("about it") || query.includes("that"))) {
     if (contextKeywords) {
        query = contextKeywords.split(/\s+/).slice(0,5).join(" ") + " " + query; // limit context length
     }
  } else if (contextKeywords && query.length < originalQuery.length * 0.5) { // If query significantly shortened
    query = contextKeywords.split(/\s+/).slice(0,5).join(" ") + " " + originalQuery.toLowerCase();
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
      // If only welcome message exists, replace it if user sends a non-empty message
      if (prevMessages.length === 1 && prevMessages[0].id.startsWith('ai-welcome-')) {
        if (sender === 'user' && newMessage.text.trim() !== "") { 
             return [newMessage]; // Replace welcome with user's first message
        }
         // Otherwise, append (e.g. system message, or if user somehow sends empty)
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
          // If current text is a placeholder (like "Thinking..."), replace it with the first chunk.
          // Otherwise, append the chunk.
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
    // Prevent sending empty messages unless a file is attached
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
      // Prepare message history, excluding system messages, the current "Thinking..." AI message, and initial welcome if it's the only other one.
      const apiMessageHistory = messages
        .filter(msg => {
            if (msg.sender === 'system') return false; // Exclude system messages
             // Exclude the initial welcome message if it's still present and we are about to send the first real user message
            if (msg.id.startsWith('ai-welcome-') && messages.length <= 2 && messages.some(m=>m.id.startsWith('ai-welcome-'))) return false;
            // Exclude the current AI placeholder message
            if (msg.id === aiMessageId && (msg.text === "Thinking..." || msg.text.startsWith("Processing") || msg.text.startsWith("Searching"))) return false;
            return true; 
        })
        .slice(-10) // Take last 10 relevant messages
        .map(msg => {
          const role = msg.sender === 'user' ? 'user' : 'assistant';
          let content: any = msg.text;
          // Handle image attachments for user messages
          if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
            content = [{ type: 'text', text: msg.text || "Image attached" }];
            content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
          } else if (msg.sender === 'user' && msg.fileDataUri && !msg.filePreviewUri?.startsWith('data:image')) {
            // For non-image files, describe the upload
            content = `User uploaded a file: ${msg.fileName}. User's message: ${msg.text}`;
          }
          return { role, content };
        });
      
      // Construct the current user message for the API
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
          ...apiMessageHistory, // Add the filtered history
          currentUserMessageForAPI // Add the current user's message
        ],
        stream: true,
        http_referer: APP_SITE_URL, // Optional: For OpenRouter analytics
        x_title: APP_TITLE,        // Optional: For OpenRouter analytics
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
          // Stream finished
          break; 
        }

        buffer += decoder.decode(value, { stream: true });
        const eventSeparator = "\n\n";
        let eventEndIndex;
        // Process server-sent events (SSE)
        while ((eventEndIndex = buffer.indexOf(eventSeparator)) !== -1) {
            const eventPart = buffer.substring(0, eventEndIndex);
            buffer = buffer.substring(eventEndIndex + eventSeparator.length);

            if (eventPart.startsWith("data: ")) {
                const jsonData = eventPart.substring(6).trim();
                if (jsonData === "[DONE]") {
                    // OpenAI-like signal for stream end
                    if (reader) await reader.cancel(); 
                    reader = null; // Mark reader as cancelled/done
                    break; // Exit inner while loop for SSE processing
                }
                try {
                    const chunkData = JSON.parse(jsonData);
                    if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                        const contentChunk = chunkData.choices[0].delta.content;
                        streamMessageUpdate(aiMessageId, contentChunk);
                        accumulatedText += contentChunk;
                    } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                        // Handle finish reason (e.g., 'stop', 'length')
                        if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') { 
                            if (reader) await reader.cancel();
                            reader = null; // Mark reader as cancelled/done
                            break; // Exit inner while loop for SSE processing
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream JSON:", jsonData, e);
                    // Update message with error, but don't stop processing other potential chunks
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
                        ...msg,
                        text: `Error: Stream parsing error. ${(e as Error).message}. Data: ${jsonData.substring(0,100)}...`,
                        type: "error"
                    } : msg));
                }
            }
        }
        if (reader === null) break; // Exit outer while loop if reader was cancelled
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
        const queryForSearch = refineSearchQueryForContext(originalUserMessage?.text || text, messages);
        
        if (queryForSearch) {
          setIsSearchingWeb(true);
          // Update AI message to indicate web search is happening
          updateMessage(aiMessageId, { 
            text: `${finalAiText}\n\nSearching the web for more information about "${queryForSearch}"...`, 
            reasoning: placeholderReasoning + ` Detected uncertainty, initiating web search for "${queryForSearch}".`
          });
          try {
            const searchFlowResult = await smartWebSearch({ query: queryForSearch });
            const searchResultsMarkdownContent = searchFlowResult.searchResultsMarkdown;
            
            const collapsibleWrapper = `\n\n:::collapsible Web Search Results for "${queryForSearch}"\n${searchResultsMarkdownContent}\n:::`;
            finalAiText += collapsibleWrapper; // Append search results to the original AI text
            
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

      // Final update to the AI message with all content
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === aiMessageId) {
            let currentText = finalAiText || msg.text; // Use accumulated text, or existing if empty
            let currentType = msg.type || 'text';
            let currentReasoning = msg.reasoning || placeholderReasoning;

            // If text is still a placeholder, it means no content was streamed or an error occurred before streaming
            if (currentText === "Thinking..." || currentText.startsWith("Processing") || currentText.startsWith("Searching")) {
                 currentText = (msg.type === 'error' && msg.text !== "Thinking...") ? msg.text : "No response generated or an issue occurred. Please check the API key and model settings.";
                 if (msg.type !== 'error') currentType = 'error'; // Mark as error if no useful text
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
      
      // Use the title for the collapsible section to match the query
      const collapsibleContent = result.searchResultsMarkdown;
      const fullText = `Web search results for "${query}":\n\n:::collapsible Web Search Results for "${query}"\n${collapsibleContent}\n:::`;

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
      // More user-friendly error based on instructions
      if (baseErrorMessage.includes("Unable to find current information online") || baseErrorMessage.includes("No relevant information found online")) {
          displayedErrorMessage = "Unable to find current information online. Please check a reliable news source.";
          finalReasoning = `The web search for "${query}" did not yield relevant results based on the filtering criteria. The external API may not have found matching content or the content did not meet recency/keyword requirements.`;
      } else {
          displayedErrorMessage = `An error occurred while searching online.`;
           finalReasoning = `An error occurred while performing the web search for "${query}". The specific error was: "${baseErrorMessage}". This could be due to issues with the search API, network connectivity, or the formatting of results.`;
      }
      
      updateMessage(aiMessageId, {
        text: displayedErrorMessage, 
        type: "error",
        reasoning: finalReasoning,
        duration: durationInSeconds
      });
      toast({
        title: "Web Search Information", // Changed from "Failed" to be more neutral for "no results"
        description: baseErrorMessage.includes("Unable to find current information online") ? "No current information found via web search." : "An error occurred during web search.", 
        variant: baseErrorMessage.includes("Unable to find current information online") ? "default" : "destructive",
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
