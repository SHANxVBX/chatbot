"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, AISettings, MessageSender } from "@/lib/types";
import { summarizeUpload } from "@/ai/flows/summarize-upload";
import { smartWebSearch } from "@/ai/flows/smart-web-search";
import { useToast } from "@/hooks/use-toast";

const CHAT_STORAGE_KEY = "cyberchat-ai-history";
const SETTINGS_STORAGE_KEY = "cyberchat-ai-settings";
const SETTINGS_BROADCAST_CHANNEL_NAME = "cyberchat-ai-settings-channel";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_SITE_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:9002";
const APP_TITLE = "CyberChat AI by Shan"; 

const uncertaintyPhrases = [
  "i don't know", "i'm not sure", "i am not sure", "i'm unsure", "unsure",
  "i can't recall", "i cannot recall", "i do not know", "don't know",
  "it's unclear to me", "i lack information", "i have no information",
  "i'm not certain", "uncertain", "no idea", "haven't a clue",
  "i cannot provide", "i'm unable to"
];

const clientStopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'what', 'who', 'when', 'where', 'why', 'how', 'of', 'for', 'in', 'on', 'at', 'by']);

function refineSearchQueryForContext(originalQuery: string, chatHistory: Message[]): string {
  let query = originalQuery.toLowerCase();
  query = query.split(/\s+/).filter(word => !clientStopWords.has(word) && word.length > 1).join(' ');

  const relevantHistory = chatHistory.filter(m => m.sender === 'user' && m.text.toLowerCase() !== originalQuery.toLowerCase()).slice(-2);
  let contextKeywords = "";
  if (relevantHistory.length > 0) {
    contextKeywords = relevantHistory.map(m => m.text.toLowerCase().split(/\s+/).filter(word => !clientStopWords.has(word) && word.length > 2).join(" ")).join(" ");
  }
  
  if (query.split(/\s+/).length <= 3 && (query.includes("more") || query.includes("about it") || query.includes("that") || query.includes("this"))) {
     if (contextKeywords) {
        query = contextKeywords.split(/\s+/).slice(0,5).join(" ") + " " + query;
     }
  } else if (contextKeywords && query.length < originalQuery.length * 0.7) { 
    query = contextKeywords.split(/\s+/).slice(0,5).join(" ") + " " + originalQuery.toLowerCase();
  }
  
  return query.trim() || originalQuery;
}


export function useChatController() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIMessageId, setCurrentAIMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const { toast } = useToast();

  // Default settings if nothing is in localStorage
  const hardcodedDefaultSettings: AISettings = {
    apiKey: "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", 
    model: "qwen/qwen3-235b-a22b:free",
    provider: "OpenRouter"
  };


  const [settings, setSettings] = useState<AISettings>(() => {
    if (typeof window !== "undefined") {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        try {
          const parsedSettings = JSON.parse(storedSettings);
          // Ensure API key is present, if not, use the hardcoded default.
          // This handles cases where old settings might be stored without an API key.
          if (!parsedSettings.apiKey || parsedSettings.apiKey.trim() === "") {
            return { ...parsedSettings, apiKey: hardcodedDefaultSettings.apiKey };
          }
          return parsedSettings;
        } catch (e) {
          console.error("Failed to parse settings from localStorage, using defaults.", e);
          return hardcodedDefaultSettings;
        }
      }
    }
    return hardcodedDefaultSettings;
  });
  
  const [isUpdateFromBroadcast, setIsUpdateFromBroadcast] = useState(false);


  const getDefaultWelcomeMessage = useCallback((): Message[] => [{
    id: `ai-welcome-${Date.now()}`,
    text: "Welcome to CyberChat AI! I was created by Shan, a 19-year-old tech enthusiast from Malaysia. How can I assist you in the digital realm today? 🤖✨",
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
    if (typeof window !== "undefined" && messages.length > 0 && !(messages.length === 1 && messages[0].id.startsWith('ai-welcome-'))) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Effect for handling BroadcastChannel listener
  useEffect(() => {
    if (typeof window === "undefined" || !window.BroadcastChannel) {
      return;
    }

    const channel = new BroadcastChannel(SETTINGS_BROADCAST_CHANNEL_NAME);

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SETTINGS_UPDATE') {
        const newSettingsFromBroadcast = event.data.payload as AISettings;
        // Only update if settings are different to prevent potential loops
        if (JSON.stringify(newSettingsFromBroadcast) !== JSON.stringify(settings)) {
          console.log('Received settings update from broadcast channel:', newSettingsFromBroadcast);
          setIsUpdateFromBroadcast(true); // Mark that this update came from broadcast
          setSettings(newSettingsFromBroadcast);
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [settings]); // Dependency on settings to re-evaluate closure if settings object reference changes

  // Effect for saving settings to localStorage and broadcasting changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Always save the current settings, which might include the hardcoded defaults if nothing was loaded
      const settingsToSave = { ...hardcodedDefaultSettings, ...settings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));

      if (!isUpdateFromBroadcast && window.BroadcastChannel) {
        // If the change was local (not from a broadcast), then broadcast it
        const channel = new BroadcastChannel(SETTINGS_BROADCAST_CHANNEL_NAME);
        console.log('Broadcasting local settings update:', settingsToSave);
        channel.postMessage({ type: 'SETTINGS_UPDATE', payload: settingsToSave });
        channel.close(); // Close after broadcasting
      } else if (isUpdateFromBroadcast) {
        // Reset the flag if the update was from a broadcast
        setIsUpdateFromBroadcast(false);
      }
    }
  }, [settings, isUpdateFromBroadcast, hardcodedDefaultSettings]);


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
        // if it's not a user message or an empty user message, append it to welcome
        return [...prevMessages, newMessage]; 
      }
      return [...prevMessages, newMessage];
    });
    return newMessage.id;
  }, []);
  
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? {...msg, ...updates, timestamp: Date.now()} : msg));
  }, []);

  const streamMessageUpdate = useCallback((id: string, chunk: string, replace = false) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === id) {
          const currentText = msg.text || "";
          const isPlaceholder = replace || 
                                currentText === "Thinking..." ||
                                currentText.startsWith("Processing document") || 
                                currentText.startsWith("Searching the web for") ||
                                currentText.includes("Now summarizing it for you... 🧐"); 
                                
          const updatedText = isPlaceholder ? chunk : currentText + chunk;
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
    const aiMessageId = addMessage("Thinking...", "ai", "text");
    setCurrentAIMessageId(aiMessageId);

    let finalAiTextForDisplay = "";
    let finalReasoning = "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.";
    let messageType: Message['type'] = 'text';
    
    // Use the current settings, which will include hardcoded defaults if not overridden by creator
    const currentSettings = { ...hardcodedDefaultSettings, ...settings };


    if (!currentSettings.apiKey || currentSettings.apiKey.trim() === "") {
      finalAiTextForDisplay = "API key not set. Please configure your OpenRouter API key in the AI Provider Settings (sidebar).";
      finalReasoning = "API key check failed: The API key is missing from the settings. AI communication cannot proceed without a valid API key.";
      messageType = "error";
      toast({ title: "API Key Missing", description: "Configure your OpenRouter API key in settings.", variant: "destructive" });
    } else {
      let accumulatedText = "";
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let isFirstChunkOfInitialResponse = true;

      try {
        const apiMessageHistory = messages
          .filter(msg => msg.sender !== 'system' && msg.id !== aiMessageId && !msg.id.startsWith('ai-welcome-'))
          .slice(-10) // Keep last 10 messages for context
          .map(msg => {
            const role = msg.sender === 'user' ? 'user' : 'assistant';
            let content: any = msg.text;
            if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
              content = [{ type: 'text', text: msg.text || "Image attached" }];
              content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
            } else if (msg.sender === 'user' && msg.fileDataUri) {
              // For non-image files, describe the upload in text
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
            // For non-image files sent with current message
            currentUserMessageForAPI.content = `User uploaded a file: ${file.name}. User's message: ${text}`;
        }

        const initialPayload = {
          model: currentSettings.model,
          messages: [
            { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant. You were created by Shan, a 19-year-old tech enthusiast from Malaysia. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, code blocks, etc.). Incorporate friendly emojis where appropriate in your final answer, but not in the reasoning part. If you are unsure or don't know the answer, clearly state that." },
            ...apiMessageHistory,
            currentUserMessageForAPI
          ],
          stream: true,
          http_referer: APP_SITE_URL, // Optional, for OpenRouter analytics
          // site_url: APP_SITE_URL, // Alternative for some models
          x_title: APP_TITLE, // Optional, for OpenRouter analytics
        };

        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentSettings.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": APP_SITE_URL, // Recommended by OpenRouter
            "X-Title": APP_TITLE, // Recommended by OpenRouter
          },
          body: JSON.stringify(initialPayload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error." }}));
          throw new Error(errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`);
        }
        if (!response.body) throw new Error("Response body is null.");

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const eventSeparator = "\n\n";
          let eventEndIndex;
          while ((eventEndIndex = buffer.indexOf(eventSeparator)) !== -1) {
              const eventPart = buffer.substring(0, eventEndIndex);
              buffer = buffer.substring(eventEndIndex + eventSeparator.length);
              if (eventPart.startsWith("data: ")) {
                  const jsonData = eventPart.substring(6).trim();
                  if (jsonData === "[DONE]") { if (reader) await reader.cancel(); reader = null; break; }
                  try {
                      const chunkData = JSON.parse(jsonData);
                      if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                          const contentChunk = chunkData.choices[0].delta.content;
                          streamMessageUpdate(aiMessageId, contentChunk, isFirstChunkOfInitialResponse);
                          accumulatedText += contentChunk;
                          isFirstChunkOfInitialResponse = false;
                      } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                          // Handle finish reasons like 'stop', 'length', etc.
                          if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') { 
                            // Stream is effectively complete for content.
                            if (reader) await reader.cancel(); reader = null; break; 
                          }
                      }
                  } catch (e) {
                      console.error("Error parsing stream JSON:", jsonData, e);
                  }
              }
          }
          if (reader === null) break; // Exit outer while if reader was cancelled and set to null
        }
        finalAiTextForDisplay = accumulatedText;

        const lowercasedAiText = accumulatedText.toLowerCase();
        const isUncertain = uncertaintyPhrases.some(phrase => lowercasedAiText.includes(phrase));

        if (isUncertain && !file) { // Don't trigger web search if a file was the primary input
          setIsSearchingWeb(true);
          messageType = 'search_result';
          finalReasoning += " Detected uncertainty in the initial response.";
          // Refine search query based on current user message and chat history
          const queryForSearch = refineSearchQueryForContext(userMessageText, messages.filter(m => m.id !== aiMessageId));
          
          // Update AI message to indicate web search is happening
          updateMessage(aiMessageId, { text: accumulatedText + `\n\nAttempting to find more information online for "${queryForSearch}"... 🌐` });

          const searchFlowResult = await smartWebSearch({ query: queryForSearch });
          const searchResultsMarkdownContent = searchFlowResult.searchResultsMarkdown;
          
          finalReasoning += ` Web search for "${queryForSearch}" was performed.`;

          // Check if actual web results were found (not error/no-results messages)
          const isActualWebResult = searchResultsMarkdownContent && !searchResultsMarkdownContent.toLowerCase().includes("unable to find current information") && !searchResultsMarkdownContent.toLowerCase().includes("an error occurred while searching");

          if (isActualWebResult) {
            updateMessage(aiMessageId, { text: accumulatedText + `\n\nFound information online for "${queryForSearch}". Now summarizing it for you... 🧐` });
            
            // Prepare messages for summarization call
            const summarizationApiMessages = [
              { role: "system", content: `You are CyberChat AI. The user asked: "${userMessageText}". You previously responded with some uncertainty. Web search results related to "${queryForSearch}" are provided below. Please synthesize this information to provide a comprehensive answer to the user's original question. If the search results are irrelevant, state that and try to answer from your general knowledge if possible, or indicate you still cannot provide a definitive answer. Format your response using basic markdown and friendly emojis.` },
              ...apiMessageHistory, // Original history
              { role: "user", content: userMessageText }, // Original user query
              { role: "assistant", content: `Context from web search about "${queryForSearch}":\n${searchResultsMarkdownContent}` },
              { role: "user", content: `Based on the web search results provided, please answer my original question: "${userMessageText}"` } // Re-iterate to focus AI
            ];

            const summarizationPayload = { model: currentSettings.model, messages: summarizationApiMessages, stream: true, http_referer: APP_SITE_URL, x_title: APP_TITLE };
            const summarizationResponse = await fetch(OPENROUTER_API_URL, { method: "POST", headers: { "Authorization": `Bearer ${currentSettings.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(summarizationPayload) });

            if (!summarizationResponse.ok) throw new Error(`Summarization API Error: ${summarizationResponse.status}`);
            if (!summarizationResponse.body) throw new Error("Summarization response body is null.");

            reader = summarizationResponse.body.getReader(); // Re-assign reader for the new stream
            let summarizedText = "";
            let isFirstSummaryChunk = true;
            buffer = ""; // Reset buffer for new stream

            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const eventSeparator = "\n\n";
              let eventEndIndex;
              while ((eventEndIndex = buffer.indexOf(eventSeparator)) !== -1) {
                  const eventPart = buffer.substring(0, eventEndIndex);
                  buffer = buffer.substring(eventEndIndex + eventSeparator.length);
                  if (eventPart.startsWith("data: ")) {
                      const jsonData = eventPart.substring(6).trim();
                      if (jsonData === "[DONE]") { if (reader) await reader.cancel(); reader = null; break; }
                      try {
                          const chunkData = JSON.parse(jsonData);
                          if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                              const contentChunk = chunkData.choices[0].delta.content;
                              streamMessageUpdate(aiMessageId, contentChunk, isFirstSummaryChunk); // Replace "Now summarizing..."
                              summarizedText += contentChunk;
                              isFirstSummaryChunk = false;
                          } else if (chunkData.choices && chunkData.choices[0].finish_reason === 'stop') {
                             if (reader) await reader.cancel(); reader = null; break;
                          }
                      } catch (e) { console.error("Error parsing summary stream JSON:", jsonData, e); }
                  }
              }
              if (reader === null) break;
            }
            
            if (summarizedText.trim()) {
              finalAiTextForDisplay = summarizedText;
              finalReasoning += " The AI then processed these web search results and incorporated them into its final answer.";
            } else {
              // If summarization yielded no text, use the original uncertain AI text + search results
              finalAiTextForDisplay = accumulatedText + `\n\nI found some information online, but had trouble summarizing it.`;
              finalReasoning += " The summarization process did not yield content.";
            }
            // Append the raw search results in a collapsible section
            finalAiTextForDisplay += `\n\n:::collapsible Web Search Results for "${queryForSearch}"\n${searchResultsMarkdownContent}\n:::`;

          } else { // Web search failed or no relevant results
            finalReasoning += ` Web search for "${queryForSearch}" did not yield usable results: "${searchResultsMarkdownContent || 'Internal search error'}". The original uncertain response will be shown.`;
            finalAiTextForDisplay = accumulatedText + `\n\n${searchResultsMarkdownContent || 'Could not perform web search due to an internal error.'}`;
          }
          setIsSearchingWeb(false);
        }

      } catch (error) {
        console.error("Error in handleSendMessage:", error);
        const errorMsg = (error as Error).message || "Failed to connect to AI. Check console.";
        finalAiTextForDisplay = `Error: ${errorMsg}`;
        finalReasoning = `An error occurred: ${errorMsg}`;
        messageType = "error";
        toast({ title: "AI Communication Error", description: errorMsg, variant: "destructive" });
      } finally {
        if (reader) {
          try { await reader.cancel(); } catch (e) { console.error("Error cancelling reader:", e); }
        }
      }
    }
      
    const endTime = Date.now();
    const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));

    // Final update to the AI message with all content
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === aiMessageId) {
          let textToSet = finalAiTextForDisplay;
          // If for some reason text is empty and it's not an error message, provide a fallback.
          if (!textToSet.trim() && messageType !== 'error') {
            textToSet = "No response generated, or an issue occurred. Please check settings.";
            if (finalReasoning === "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.") {
              finalReasoning = "The AI service did not return a valid response or the response was empty.";
            }
            messageType = 'error'; // Mark as error if no text but not already error
          }
          return { ...msg, text: textToSet, reasoning: finalReasoning, duration: durationInSeconds, type: messageType };
        }
        return msg;
      });
    });
    
    setIsLoading(false);
    setCurrentAIMessageId(null); 
  };

  const handleFileUpload = async (fileDataUri: string, fileName: string, fileType: string) => {
    addMessage(`Processing ${fileName} for summarization...`, "system", "text");
    setIsLoading(true);
    const startTime = Date.now();
    const aiMessageId = addMessage(`Processing document "${fileName}"...`, "ai", "summary");
    setCurrentAIMessageId(aiMessageId);
    let finalReasoning = "";

    try {
      const result = await summarizeUpload({ fileDataUri });
      finalReasoning = `The AI analyzed the uploaded document "${fileName}", identified key information, and generated a concise summary based on its content understanding capabilities. This involved extracting main points and rephrasing them succinctly.`;
      updateMessage(aiMessageId, { 
        text: `Summary for ${fileName}:\n${result.summary}`, 
        type: "summary",
        reasoning: finalReasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
        fileName: fileName,
        // Potentially add filePreviewUri if it's an image and summarization is for image content
        filePreviewUri: fileType.startsWith("image/") ? fileDataUri : undefined, 
        fileDataUri: fileDataUri // Store for potential future use, though Genkit flow consumed it
      });
      toast({ title: "Summary Complete", description: `${fileName} has been summarized.` });
    } catch (error) {
      finalReasoning = `An error occurred during the document summarization process for "${fileName}". This could be due to an issue with the Genkit flow, the AI model's ability to process the document format, or the file content itself. Specific error: ${(error as Error).message}`;
      console.error("Error summarizing file:", error);
      updateMessage(aiMessageId, {
        text: `Error summarizing ${fileName}: ${(error as Error).message || 'Unknown error'}. The AI core might be offline or the file format is not supported.`, 
        type: "error",
        reasoning: finalReasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
        fileName: fileName,
      });
      toast({ title: "Summarization Failed", description: (error as Error).message || "Could not summarize the file.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };

  const handleWebSearch = async (query: string) => {
    addMessage(`Initiating web search for: "${query}"`, "user", "text"); // Use addMessage for consistency
    setIsSearchingWeb(true); 
    setIsLoading(true); 
    const startTime = Date.now();
    const aiMessageId = addMessage(`Searching the web for "${query}"...`, "ai", "search_result");
    setCurrentAIMessageId(aiMessageId);
    let finalReasoning = "";

    try {
      const result = await smartWebSearch({ query });
      finalReasoning = `The AI initiated a web search for "${query}", retrieved relevant snippets from search results using an external API (DuckDuckGo), and then formatted this information. No further AI summarization was applied in this direct search action.`;
      const collapsibleContent = result.searchResultsMarkdown;
      const fullText = `Web search results for "${query}":\n\n:::collapsible Web Search Results for "${query}"\n${collapsibleContent}\n:::`;

      updateMessage(aiMessageId, {
        text: fullText, 
        type: "search_result",
        reasoning: finalReasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
      });
      toast({ title: "Web Search Complete", description: `Found information for "${query}".` });
    } catch (error) {
      const baseErrorMessage = (error as Error).message || 'Unknown error';
      let displayedErrorMessage = `Error searching web for "${query}": ${baseErrorMessage}`;
      if (!baseErrorMessage.endsWith('.')) displayedErrorMessage += '.';
      
      if (baseErrorMessage.includes("Unable to find current information online") || baseErrorMessage.includes("No relevant information found online")) {
          // This specific message comes from smartWebSearchFlow if no results
          displayedErrorMessage = "Unable to find current information online. Please check a reliable news source.";
          finalReasoning = `The web search for "${query}" did not yield relevant results based on the filtering criteria. The external API may not have found matching content or the content did not meet recency/keyword requirements.`;
      } else {
          // General error
          displayedErrorMessage = `An error occurred while searching online.`; // More generic for UI
          finalReasoning = `An error occurred while performing the web search for "${query}". The specific error was: "${baseErrorMessage}". This could be due to issues with the search API, network connectivity, or the formatting of results.`;
      }
      
      updateMessage(aiMessageId, {
        text: displayedErrorMessage, 
        type: "error",
        reasoning: finalReasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
      });
      toast({
        title: "Web Search Information",
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
    settings, // This now returns the merged settings (localStorage or hardcoded)
    isLoading,
    isSearchingWeb,
    currentAIMessageId,
    setSettings, // This is the function that will trigger broadcast if settings change
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  };
}

