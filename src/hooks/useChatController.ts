
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
const APP_TITLE = "CyberChat AI by Shan"; // Updated App Title

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

  const [settings, setSettings] = useState<AISettings>(() => {
    if (typeof window !== "undefined") {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return storedSettings
        ? JSON.parse(storedSettings)
        : { apiKey: "", model: "openrouter/auto", provider: "OpenRouter" }; // Default to OpenRouter and auto model
    }
    return { apiKey: "", model: "openrouter/auto", provider: "OpenRouter" };
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

  const streamMessageUpdate = useCallback((id: string, chunk: string, replace = false) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === id) {
          const currentText = msg.text || "";
          // Replace if `replace` is true OR if current text is a known placeholder
          const isPlaceholder = replace || 
                                currentText === "Thinking..." ||
                                currentText.startsWith("Processing document") || 
                                currentText.startsWith("Searching the web for") ||
                                currentText.includes("Now summarizing it for you... 🧐"); // For summarization placeholder
                                
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

    const userMessageId = addMessage(userMessageText, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
    setIsLoading(true);
    
    const startTime = Date.now();
    const aiMessageId = addMessage("Thinking...", "ai", "text");
    setCurrentAIMessageId(aiMessageId);

    let finalAiTextForDisplay = "";
    let finalReasoning = "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.";
    let messageType: Message['type'] = 'text';

    if (!settings.apiKey || settings.apiKey.trim() === "") {
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
          .slice(-10)
          .map(msg => {
            const role = msg.sender === 'user' ? 'user' : 'assistant';
            let content: any = msg.text;
            if (msg.sender === 'user' && msg.fileDataUri && msg.filePreviewUri?.startsWith('data:image')) {
              content = [{ type: 'text', text: msg.text || "Image attached" }];
              content.push({ type: 'image_url', image_url: { url: msg.fileDataUri } });
            } else if (msg.sender === 'user' && msg.fileDataUri) {
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

        const initialPayload = {
          model: settings.model,
          messages: [
            { role: "system", content: "You are CyberChat AI, a helpful and slightly futuristic AI assistant created by Shan. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, code blocks, etc.). Incorporate friendly emojis where appropriate in your final answer, but not in the reasoning part. If you are unsure or don't know the answer, clearly state that." },
            ...apiMessageHistory,
            currentUserMessageForAPI
          ],
          stream: true,
          http_referer: APP_SITE_URL,
          x_title: APP_TITLE,
        };

        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${settings.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": APP_SITE_URL, "X-Title": APP_TITLE },
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
                          if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') { 
                            if (reader) await reader.cancel(); reader = null; break; 
                          }
                      }
                  } catch (e) { console.error("Error parsing stream JSON:", jsonData, e); }
              }
          }
          if (reader === null) break;
        }
        finalAiTextForDisplay = accumulatedText;

        // Uncertainty check and potential second AI call
        const lowercasedAiText = accumulatedText.toLowerCase();
        const isUncertain = uncertaintyPhrases.some(phrase => lowercasedAiText.includes(phrase));

        if (isUncertain && !file) {
          setIsSearchingWeb(true);
          messageType = 'search_result';
          finalReasoning += " Detected uncertainty in the initial response.";
          const queryForSearch = refineSearchQueryForContext(userMessageText, messages);
          
          updateMessage(aiMessageId, { text: accumulatedText + `\n\nAttempting to find more information online for "${queryForSearch}"... 🌐` });

          const searchFlowResult = await smartWebSearch({ query: queryForSearch });
          const searchResultsMarkdownContent = searchFlowResult.searchResultsMarkdown;
          
          finalReasoning += ` Web search for "${queryForSearch}" was performed.`;

          const isActualWebResult = searchResultsMarkdownContent && !searchResultsMarkdownContent.toLowerCase().includes("unable to find current information") && !searchResultsMarkdownContent.toLowerCase().includes("an error occurred while searching");

          if (isActualWebResult) {
            updateMessage(aiMessageId, { text: accumulatedText + `\n\nFound information online for "${queryForSearch}". Now summarizing it for you... 🧐` });
            
            const summarizationApiMessages = [
              { role: "system", content: `You are CyberChat AI. The user asked: "${userMessageText}". You previously responded with some uncertainty. Web search results related to "${queryForSearch}" are provided below. Please synthesize this information to provide a comprehensive answer to the user's original question. If the search results are irrelevant, state that and try to answer from your general knowledge if possible, or indicate you still cannot provide a definitive answer. Format your response using basic markdown and friendly emojis.` },
              ...apiMessageHistory, // Original history
              { role: "user", content: userMessageText }, // Original user query
              { role: "assistant", content: `Context from web search about "${queryForSearch}":\n${searchResultsMarkdownContent}` },
              { role: "user", content: `Based on the web search results provided, please answer my original question: "${userMessageText}"` } // Re-iterate to focus AI
            ];

            const summarizationPayload = { model: settings.model, messages: summarizationApiMessages, stream: true, http_referer: APP_SITE_URL, x_title: APP_TITLE };
            const summarizationResponse = await fetch(OPENROUTER_API_URL, { method: "POST", headers: { "Authorization": `Bearer ${settings.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(summarizationPayload) });

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
              finalAiTextForDisplay = accumulatedText + `\n\nI found some information online, but had trouble summarizing it.`;
              finalReasoning += " The summarization process did not yield content.";
            }
            finalAiTextForDisplay += `\n\n:::collapsible Web Search Results for "${queryForSearch}"\n${searchResultsMarkdownContent}\n:::`;

          } else { // Web search failed or no relevant results
            finalReasoning += ` Web search for "${queryForSearch}" did not yield usable results: "${searchResultsMarkdownContent || 'Internal search error'}".`;
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

    setMessages(prev => {
      return prev.map(msg => {
        if (msg.id === aiMessageId) {
          let textToSet = finalAiTextForDisplay;
          if (!textToSet.trim() && messageType !== 'error') {
            textToSet = "No response generated, or an issue occurred. Please check settings.";
            if (finalReasoning === "The AI processed the input, considered relevant information from its knowledge base and the conversation history, and generated the most appropriate response according to its programming and the provided context.") {
              finalReasoning = "The AI service did not return a valid response or the response was empty.";
            }
            messageType = 'error';
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
    addMessage(`Initiating web search for: "${query}"`, "user", "text");
    setIsSearchingWeb(true); 
    setIsLoading(true); 
    const startTime = Date.now();
    const aiMessageId = addMessage(`Searching the web for "${query}"...`, "ai", "search_result");
    setCurrentAIMessageId(aiMessageId);
    let finalReasoning = "";

    try {
      const result = await smartWebSearch({ query });
      finalReasoning = `The AI initiated a web search for "${query}", retrieved relevant snippets from search results using an external API (DuckDuckGo), and then formatted this information.`;
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

    