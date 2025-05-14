"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Paperclip, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ChatInputBarProps {
  onSendMessage: (text: string, file?: { dataUri: string; name: string; type: string }) => void;
  isLoading: boolean;
  onClearChat: () => void;
}

const MAX_FILE_SIZE_INPUT = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES_INPUT = ".txt,.jpg,.jpeg,.png,.pdf";

export function ChatInputBar({ onSendMessage, isLoading, onClearChat }: ChatInputBarProps) {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ dataUri: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; 
    }
  }, [inputText]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleSend = () => {
    if (isLoading) return;
    const textToSend = inputText.trim();
    if (!textToSend && !selectedFile) return;

    onSendMessage(textToSend, selectedFile || undefined);
    setInputText("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_INPUT) {
        toast({ title: "File Too Large", description: "Max file size is 10MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({ dataUri: reader.result as string, name: file.name, type: file.type });
        toast({ title: "File Attached", description: `${file.name} is ready to be sent.` });
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div className="border-t border-border/30 bg-background/70 p-2 sm:p-3 md:p-4 shadow-md backdrop-blur-md">
      {selectedFile && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-primary">
          <span>File: {selectedFile.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Transmit your query... (Shift+Enter for new line)"
          className="flex-1 resize-none rounded-lg border-border/50 bg-input/50 p-3 text-base shadow-inner focus:ring-primary/50 glassmorphic-input max-h-40 overflow-y-auto"
          rows={1}
          disabled={isLoading}
        />
        <div className="flex flex-row items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="text-primary/80 hover:text-primary hover:bg-primary/10 aspect-square"
            disabled={isLoading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept={ACCEPTED_FILE_TYPES_INPUT}
          />
           <Button
            onClick={onClearChat}
            variant="ghost"
            size="icon"
            aria-label="Clear chat"
            className="text-destructive/80 hover:text-destructive hover:bg-destructive/10 aspect-square"
            disabled={isLoading}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && !selectedFile)}
            className="bg-primary/90 hover:bg-primary text-primary-foreground aspect-square sm:aspect-auto sm:px-3 py-2 shadow-md hover:shadow-primary/40 transition-all duration-300 ease-in-out transform hover:scale-105"
            aria-label="Send message"
          >
            <SendHorizonal className="h-5 w-5 sm:mr-0 md:mr-2" />
            <span className="hidden md:inline">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
