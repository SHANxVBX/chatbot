
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
  apiKeys: string[]; // Array of up to 5 API keys for OpenRouter
  model: string; // For OpenRouter
  provider: string; // Label, e.g., "OpenRouter"
  currentApiKeyIndex: number; // Index for OpenRouter keys
  userAvatarUri?: string; // Data URI for custom user avatar
  googleApiKey?: string; // API Key for Google AI Services (e.g., Gemini for file processing)
}

