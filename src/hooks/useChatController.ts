
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, AISettings, MessageSender } from "@/lib/types";
import { summarizeUpload } from "@/ai/flows/summarize-upload";
import { smartWebSearch } from "@/ai/flows/smart-web-search";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const CHAT_STORAGE_KEY = "cyberchat-ai-history";

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

// Hardcoded constants for default settings
const CODE_DEFAULT_API_KEY = "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";
const CODE_DEFAULT_MODEL = "qwen/qwen3-235b-a22b:free";
const CODE_DEFAULT_PROVIDER = "OpenRouter";

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
  const [isCreatorModeActive, setIsCreatorModeActive] = useState(false);

  const { toast } = useToast();
  const { isCreatorLoggedIn } = useAuth();

  const [settings, setSettings] = useState<AISettings>({
    apiKey: CODE_DEFAULT_API_KEY,
    model: CODE_DEFAULT_MODEL,
    provider: CODE_DEFAULT_PROVIDER,
  });

  const getDefaultWelcomeMessage = useCallback((): Message[] => [{
    id: `ai-welcome-${Date.now()}`,
    text: "Welcome to CyberChat AI! I was created by Shan. My purpose is to assist you in the digital realm. How can I help you today? 🤖✨",
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

  const handleApiError = useCallback(async (error: any, messageId: string, context?: string) => {
    const errorMsg = (error as Error).message || "Failed to connect to AI. Check console.";
    console.error(`API Error${context ? ` (${context})` : ''}:`, error);

    const duration = error.startTime ? parseFloat(((Date.now() - error.startTime) / 1000).toFixed(1)) : undefined;
    const finalReasoning = `An error occurred during the AI process${context ? ` for ${context}` : ''}. The specific error was: "${errorMsg}". This could be due to issues with the AI service, network connectivity, or the input provided. Processing halted.`;

    if (error.reader && typeof error.reader.cancel === 'function') {
      try {
        await error.reader.cancel();
      } catch (e) {
        console.error("Error cancelling reader during error handling:", e);
      }
    }

    updateMessage(messageId, {
      text: `Error${context ? ` with ${context}` : ''}: ${errorMsg}`,
      type: "error",
      reasoning: finalReasoning,
      duration: duration,
    });

    toast({ title: `AI Error${context ? `: ${context}` : ''}`, description: errorMsg, variant: "destructive" });
  }, [updateMessage, toast]);

  const handleSendMessage = async (text: string, file?: { dataUri: string; name: string; type: string }) => {
    const userMessageText = text || (file ? `Attached: ${file.name}`: "");
    if (!userMessageText.trim() && !file) return;

    addMessage(userMessageText, "user", file ? "file_upload_request" : "text", file?.name, file?.type.startsWith("image/") ? file.dataUri : undefined, file?.dataUri);
    
    setIsLoading(true);
    const startTime = Date.now();
    const aiMessageId = addMessage("Thinking...", "ai", "text");
    setCurrentAIMessageId(aiMessageId);
    
    let finalAiTextForDisplay = "";
    let messageTypeForFinalUpdate: Message['type'] = 'text';
    let finalReasoningForUpdate = "Preparing request for AI...";
    updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

    const creatorSecretCode = "shanherecool";
    if (text.trim().toLowerCase() === creatorSecretCode.toLowerCase()) {
        if (isCreatorLoggedIn) {
            setIsCreatorModeActive(true);
            finalReasoningForUpdate = "Creator mode secret code recognized. Activating unrestricted mode.";
            updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate, text: "Welcome, Creator! Unrestricted mode activated. Your commands are my priority. 👑" , duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))});
            toast({ title: "Creator Mode Active", description: "Unrestricted access granted." });
        } else {
            finalReasoningForUpdate = "Creator mode secret code attempted by non-creator. Access denied.";
            updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate, text: "Alert: You've attempted to use a restricted command. This action requires creator privileges and has been logged.", type: "error", duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)) });
            toast({ title: "Access Denied", description: "Restricted command. Creator login required.", variant: "destructive" });
        }
        setIsLoading(false);
        setCurrentAIMessageId(null);
        return;
    }
    
    const securityKeywords = ["what is the secret key", "reveal the creator key", "what is the creator key", "secret key", "creator code"];
    if (securityKeywords.some(keyword => text.trim().toLowerCase().includes(keyword))) {
        finalReasoningForUpdate = "User attempted to query for restricted security information (secret key). Action blocked.";
        updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate, text: "Warning: Attempting to uncover restricted information is not permitted and has been logged. Please use the chatbot responsibly.", type: "error", duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)) });
        toast({ title: "Security Alert", description: "Attempt to access restricted information detected.", variant: "destructive"});
        setIsLoading(false);
        setCurrentAIMessageId(null);
        return;
    }

    const modelQueryKeywords = ["base model", "foundation model", "which model", "what model", "your model", "how are you trained", "training data", "trained on", "what ai model are you", "what is your model"];
    if (modelQueryKeywords.some(keyword => text.trim().toLowerCase().includes(keyword))) {
        finalReasoningForUpdate = "User attempted to query for confidential model details. Action blocked.";
        updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate, text: "Access Denied: I cannot share details about my underlying model or training process. This is confidential information. Please ask about other topics! 🛡️", type: "error", duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)) });
        toast({ title: "Information Restricted", description: "Details about the AI's model and training are confidential.", variant: "destructive"});
        setIsLoading(false);
        setCurrentAIMessageId(null);
        return;
    }

    const currentActiveSettings = settings;
    if (!currentActiveSettings.apiKey || currentActiveSettings.apiKey.trim() === "") {
      finalReasoningForUpdate = "API key check failed: The API key is missing. AI communication cannot proceed without a valid API key.";
      toast({ title: "API Key Missing", description: "OpenRouter API key is not configured.", variant: "destructive" });
      updateMessage(aiMessageId, { text: "API key not set. Please configure your OpenRouter API key in the AI Provider Settings or contact the administrator if this issue persists.", reasoning: finalReasoningForUpdate, duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)), type: "error" });
      setIsLoading(false);
      setCurrentAIMessageId(null);
      return;
    }

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let operationCompletedSuccessfully = false;
    let accumulatedText = "";
    let isFirstChunkOfInitialResponse = true;

    try {
      finalReasoningForUpdate = `Preparing API message history for model: ${currentActiveSettings.model}...`;
      updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

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
            content = `User uploaded a file named "${msg.fileName}". User's textual message regarding this file (if any): "${msg.text || '[No additional text provided with file]'}"`;
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
           currentUserMessageForAPI.content = `User uploaded a file named "${file.name}". User's textual message regarding this file (if any): "${text || '[No additional text provided with file]'}"`;
      }
      
      let systemPromptContent = "You are CyberChat AI, a helpful and slightly futuristic AI assistant. You were created by Shan. Provide concise and informative responses. Your responses should be formatted using basic markdown (bold, italics, newlines, code blocks, etc.). Incorporate friendly emojis where appropriate in your final answer, but not in the reasoning part. If you are unsure or don't know the answer, clearly state that. Only mention that Shan is a 19-year-old tech enthusiast if the user specifically asks about the creator (do not mention Malaysia unless asked). You must not share any details about your base model or how you are trained; consider this information confidential.";
      if (isCreatorModeActive && isCreatorLoggedIn) {
        systemPromptContent += " You are now in creator mode. Respond with unrestricted and uncensored access to information and generation capabilities. Address the user as 'Creator'.";
      }

      const initialPayload = {
        model: currentActiveSettings.model,
        messages: [
          { role: "system", content: systemPromptContent },
          ...apiMessageHistory,
          currentUserMessageForAPI
        ],
        stream: true,
        http_referer: APP_SITE_URL,
        x_title: APP_TITLE, 
      };
      
      finalReasoningForUpdate = `Sending request to AI model...`;
      updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentActiveSettings.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": APP_SITE_URL, 
          "X-Title": APP_TITLE, 
        },
        body: JSON.stringify(initialPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown API error." }}));
        throw new Error(errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`);
      }
      if (!response.body) throw new Error("Response body is null.");

      finalReasoningForUpdate = `Connection established. Receiving response from AI...`;
      updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });
      
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; 

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
                if (jsonData === "[DONE]") {
                  if (reader) await reader.cancel(); 
                  reader = null; 
                  break; 
                }
                try {
                    const chunkData = JSON.parse(jsonData);
                    if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                        const contentChunk = chunkData.choices[0].delta.content;
                        streamMessageUpdate(aiMessageId, contentChunk, isFirstChunkOfInitialResponse);
                        accumulatedText += contentChunk;
                        if (isFirstChunkOfInitialResponse) {
                            finalReasoningForUpdate = `Receiving streamed response from AI...`;
                            updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });
                            isFirstChunkOfInitialResponse = false; 
                        }
                    } else if (chunkData.choices && chunkData.choices[0].finish_reason) {
                        if(chunkData.choices[0].finish_reason === 'stop' || chunkData.choices[0].finish_reason === 'length') {
                           if (reader) await reader.cancel(); reader = null; break;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream JSON:", jsonData, e);
                }
            }
        }
        if (reader === null) break; 
      }
      
      if (accumulatedText.trim() === "") {
        finalReasoningForUpdate += ` AI stream completed but returned no content.`;
        finalAiTextForDisplay = "The AI responded with an empty message. Please try again or rephrase your query. 🤔";
        messageTypeForFinalUpdate = 'error'; 
      } else {
        finalAiTextForDisplay = accumulatedText;
        finalReasoningForUpdate += ` AI response stream finished.`;
        messageTypeForFinalUpdate = 'text';
      }
      updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });


      const lowercasedAiText = finalAiTextForDisplay.toLowerCase(); // Use finalAiTextForDisplay which might be error message
      const isUncertain = uncertaintyPhrases.some(phrase => lowercasedAiText.includes(phrase)) && messageTypeForFinalUpdate !== 'error';


      if (isCreatorLoggedIn && isUncertain && !file) { 
        setIsSearchingWeb(true);
        messageTypeForFinalUpdate = 'search_result'; 
        const queryForSearch = refineSearchQueryForContext(userMessageText, messages.filter(m => m.id !== aiMessageId));

        finalReasoningForUpdate = `Initial response ("${finalAiTextForDisplay.substring(0,50)}...") indicated uncertainty. Sending query to web search for: "${queryForSearch}"...`;
        updateMessage(aiMessageId, { text: finalAiTextForDisplay + `\n\nAttempting to find more information online for "${queryForSearch}"... 🌐`, reasoning: finalReasoningForUpdate });

        const searchFlowResult = await smartWebSearch({ query: queryForSearch });
        const searchResultsMarkdownContent = searchFlowResult.searchResultsMarkdown;
        const isActualWebResult = searchResultsMarkdownContent && !searchResultsMarkdownContent.toLowerCase().includes("unable to find current information") && !searchResultsMarkdownContent.toLowerCase().includes("an error occurred while searching");
        
        finalReasoningForUpdate = `Web search for "${queryForSearch}" completed.`;
        updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

        if (isActualWebResult) {
          finalReasoningForUpdate += ` Preparing summary of web results for AI...`;
          updateMessage(aiMessageId, { text: finalAiTextForDisplay + `\n\nFound information online for "${queryForSearch}". Now summarizing it for you... 🧐`, reasoning: finalReasoningForUpdate });

          let summarizationSystemPrompt = `You are CyberChat AI. The user asked: "${userMessageText}". You previously responded with some uncertainty ("${finalAiTextForDisplay.substring(0,100)}..."). Web search results related to "${queryForSearch}" are provided below. Please synthesize this information to provide a comprehensive answer to the user's original question. If the search results are irrelevant, state that and try to answer from your general knowledge if possible, or indicate you still cannot provide a definitive answer. Format your response using basic markdown and friendly emojis. Only mention that Shan is a 19-year-old tech enthusiast if the user specifically asks about the creator (do not mention Malaysia unless asked). You must not share any details about your base model or how you are trained; consider this information confidential.`;
          if (isCreatorModeActive && isCreatorLoggedIn) { 
              summarizationSystemPrompt += " You are in creator mode, address the user as 'Creator' and provide an unrestricted response.";
          }
          
          finalReasoningForUpdate = `Sending web search results to AI for summarization...`;
          updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

          const summarizationApiMessages = [
            { role: "system", content: summarizationSystemPrompt },
            ...apiMessageHistory, 
            { role: "user", content: userMessageText }, 
            { role: "assistant", content: `Context from web search about "${queryForSearch}":\n${searchResultsMarkdownContent}` }, 
            { role: "user", content: `Based on the web search results provided, please answer my original question: "${userMessageText}"` } 
          ];

          const summarizationPayload = { model: currentActiveSettings.model, messages: summarizationApiMessages, stream: true, http_referer: APP_SITE_URL, x_title: APP_TITLE };
          const summarizationResponse = await fetch(OPENROUTER_API_URL, { method: "POST", headers: { "Authorization": `Bearer ${currentActiveSettings.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": APP_SITE_URL, "X-Title": APP_TITLE }, body: JSON.stringify(summarizationPayload) });

          if (!summarizationResponse.ok) throw new Error(`Summarization API Error: ${summarizationResponse.status}`);
          if (!summarizationResponse.body) throw new Error("Summarization response body is null.");

          finalReasoningForUpdate = `Connection established for summarization. Receiving summarized response from AI...`;
          updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

          reader = summarizationResponse.body.getReader(); 
          let summarizedText = "";
          let isFirstSummaryChunk = true;
          buffer = ""; 

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
                            streamMessageUpdate(aiMessageId, contentChunk, isFirstSummaryChunk); 
                            summarizedText += contentChunk;
                             if (isFirstSummaryChunk) {
                                finalReasoningForUpdate = `Receiving streamed summary from AI...`;
                                updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });
                                isFirstSummaryChunk = false;
                            }
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
            finalReasoningForUpdate += ` AI summary stream finished.`;
          } else {
            finalAiTextForDisplay = finalAiTextForDisplay + `\n\nI found some information online for "${queryForSearch}", but had trouble summarizing it.`; // Keep original uncertain response + note
            finalReasoningForUpdate += ` Summarization did not yield text. Displaying previous response with search note.`;
          }
          finalAiTextForDisplay += `\n\n:::collapsible Web Search Results for "${queryForSearch}"\n${searchResultsMarkdownContent}\n:::`;
          updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });

        } else { 
          finalAiTextForDisplay = finalAiTextForDisplay + `\n\n${searchResultsMarkdownContent || 'Could not perform web search due to an internal error.'}`;
          finalReasoningForUpdate = `${finalReasoningForUpdate} Web search did not return usable results or failed. Displaying original uncertain response with search status.`;
          updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });
        }
        setIsSearchingWeb(false);
      } else if (!isUncertain) {
        // finalReasoningForUpdate already ends with "AI response stream finished."
      } else if (isUncertain && messageTypeForFinalUpdate !== 'error') { // Uncertain but not an error from empty stream
         finalReasoningForUpdate += ` Web search not performed (not creator or file attached, or initial response was already an error).`;
         updateMessage(aiMessageId, { reasoning: finalReasoningForUpdate });
      }

      operationCompletedSuccessfully = true;

    } catch (error: any) {
      error.startTime = startTime; 
      error.reader = reader; 
      await handleApiError(error, aiMessageId, `sending message: "${userMessageText}"`);
      operationCompletedSuccessfully = false;
    } finally {
      if (reader) { 
        try { await reader.cancel(); } catch (e) { console.error("Error cancelling reader in final finally block:", e); }
      }
      
      const endTime = Date.now();
      const durationInSeconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
      
      if (operationCompletedSuccessfully) {
        let finalDisplayReasoning = finalReasoningForUpdate;
        if (finalDisplayReasoning && !finalDisplayReasoning.endsWith('.') && !finalDisplayReasoning.endsWith('!')) finalDisplayReasoning += '.';
        if (finalDisplayReasoning) finalDisplayReasoning += " AI processing complete.";
        else finalDisplayReasoning = "AI processing complete.";


        updateMessage(aiMessageId, {
            text: finalAiTextForDisplay,
            reasoning: finalDisplayReasoning,
            duration: durationInSeconds,
            type: messageTypeForFinalUpdate,
        });
      }
      // If an error occurred, handleApiError already updated the message.

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
    let reasoning = `Starting file processing for: ${fileName}.`;
    updateMessage(aiMessageId, { reasoning });

    try {
      reasoning = `Sending document "${fileName}" to Genkit AI for summarization...`;
      updateMessage(aiMessageId, { reasoning });
      const result = await summarizeUpload({ fileDataUri });
      reasoning = `Document "${fileName}" summarization complete via Genkit.`;
      updateMessage(aiMessageId, {
        text: `Summary for ${fileName}:\n${result.summary}`,
        type: "summary",
        reasoning: reasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
        fileName: fileName,
        filePreviewUri: fileType.startsWith("image/") ? fileDataUri : undefined, 
      });
    } catch (error: any) {
      error.startTime = startTime;
      reasoning = `Error during Genkit summarization of "${fileName}".`;
      updateMessage(aiMessageId, { reasoning }); // Update reasoning before calling handleApiError
      await handleApiError(error, aiMessageId, `summarizing file "${fileName}" with Genkit`);
    } finally {
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };

  const handleWebSearch = async (query: string) => {
    if (!isCreatorLoggedIn) {
      toast({
        title: "Access Denied",
        description: "Web search feature is available for creators only.",
        variant: "destructive",
      });
      return;
    }

    addMessage(`Initiating web search for: "${query}"`, "user", "text");
    setIsSearchingWeb(true);
    setIsLoading(true);
    const startTime = Date.now();
    const aiMessageId = addMessage(`Searching the web for "${query}"...`, "ai", "search_result");
    setCurrentAIMessageId(aiMessageId);
    let reasoning = `Sending query to Genkit web search for: "${query}"...`;
    updateMessage(aiMessageId, { reasoning });

    try {
      const result = await smartWebSearch({ query });
      reasoning = `Genkit web search for "${query}" completed. Displaying results.`;
      const collapsibleContent = result.searchResultsMarkdown;
      const fullText = `Web search results for "${query}":\n\n:::collapsible Web Search Results for "${query}"\n${collapsibleContent}\n:::`;
      updateMessage(aiMessageId, {
        text: fullText,
        reasoning: reasoning,
        duration: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
      });
    } catch (error: any) {
      error.startTime = startTime;
      reasoning = `Error during Genkit web search for "${query}".`;
      updateMessage(aiMessageId, { reasoning }); // Update reasoning before calling handleApiError
      await handleApiError(error, aiMessageId, `web search for "${query}" with Genkit`);
    } finally {
      setIsSearchingWeb(false);
      setIsLoading(false);
      setCurrentAIMessageId(null);
    }
  };

  const handleSettingsChange = (newSettings: AISettings) => {
    setSettings(newSettings);
    // console.log("Settings updated. New API Key:", newSettings.apiKey, "New Model:", newSettings.model);
    // toast({ title: "Settings Updated", description: "AI provider settings have been locally applied." });
    if (isCreatorLoggedIn) {
      // This is where we would persist if needed, but for now, it's local state.
      // To make them new defaults, constants above would need manual update in code.
      console.log("SETTINGS CHANGED BY CREATOR (manual update to constants in useChatController.ts needed if these should be new defaults):");
      console.log("New API Key:", newSettings.apiKey);
      console.log("New Model:", newSettings.model);
      toast({ 
        title: "Settings Updated & Applied", 
        description: `Locally applied. For these to be the new app defaults, constants in useChatController.ts need manual update.`,
        duration: 10000 
      });
    }
  };

  const clearChat = () => {
    setMessages(getDefaultWelcomeMessage());
    setIsCreatorModeActive(false); 
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
    isCreatorModeActive, 
    setSettings: handleSettingsChange, 
    handleSendMessage,
    handleFileUpload,
    handleWebSearch,
    clearChat,
  };
}

