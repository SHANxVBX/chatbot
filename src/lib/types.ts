
export type MessageSender = 'user' | 'ai' | 'system';

export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: number;
  type?: 'text' | 'summary' | 'search_result' | 'error' | 'file_upload_request';
  fileName?: string;
  fileDataUri?: string; // For sending to AI flow
  filePreviewUri?: string; // For displaying image previews
  reasoning?: string; // To store AI's thought process
  duration?: number; // To store duration of AI thought process in seconds
}

export interface AISettings {
  apiKeys: string[]; // Array of up to 5 API keys
  model: string;
  provider: string; // Remains for consistency, though OpenRouter is directly called client-side
  currentApiKeyIndex: number; // Index of the current/last successfully used API key
}
