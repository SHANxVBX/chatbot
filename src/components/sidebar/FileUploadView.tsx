
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label might not be needed if sr-only
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, ImageIcon, FileType, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FileUploadViewProps {
  onFileUpload: (fileDataUri: string, fileName: string, fileType: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ".txt,.jpg,.jpeg,.png,.pdf";
const ACCEPTED_FILE_TYPES_DISPLAY = "TXT, JPG, PNG, PDF";


export function FileUploadView({ onFileUpload }: FileUploadViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds 10MB limit.`);
        setSelectedFile(null);
        toast({ title: "File Error", description: `File size exceeds 10MB limit.`, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      const fileExtension = "." + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_FILE_TYPES.split(',').includes(fileExtension)) {
        setError(`Invalid file type. Accepted: ${ACCEPTED_FILE_TYPES_DISPLAY}`);
        setSelectedFile(null);
        toast({ title: "File Error", description: `Invalid file type. Accepted: ${ACCEPTED_FILE_TYPES_DISPLAY}`, variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("No file selected.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0); // Reset progress before starting

    // Simulate upload progress more granularly
    const simulateProgress = () => {
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.random() * 10 + 5; // More varied progress
        if (currentProgress >= 100) {
          setUploadProgress(100);
          clearInterval(interval);
        } else {
          setUploadProgress(currentProgress);
        }
      }, 150); // Faster updates
      return interval;
    };
    
    const progressInterval = simulateProgress();

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        onFileUpload(reader.result as string, selectedFile.name, selectedFile.type);
        toast({
          title: "File Ready",
          description: `${selectedFile.name} processed. Ready for AI.`,
        });
        setSelectedFile(null); // Clear selection after successful processing
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        setTimeout(() => { // Reset UI after a short delay
          setIsUploading(false);
          setUploadProgress(0);
        }, 1200);
      };
      reader.onerror = () => {
        clearInterval(progressInterval);
        setError("Error reading file.");
        setIsUploading(false);
        setUploadProgress(0);
         toast({
          title: "Upload Failed",
          description: "Could not read the selected file.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      clearInterval(progressInterval);
      setError("Upload failed. Please try again.");
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: "An unexpected error occurred during upload.",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType?: string, fileName?: string) => {
    const type = fileType || selectedFile?.type;
    const name = fileName || selectedFile?.name;

    if (!type || !name) return <FileType className="h-6 w-6 text-muted-foreground" />;
    if (type.startsWith("image/")) return <ImageIcon className="h-6 w-6 text-primary" />;
    if (type === "application/pdf" || name.endsWith(".pdf")) return <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />;
    if (type === "text/plain" || name.endsWith(".txt")) return <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />;
    return <FileType className="h-6 w-6 text-muted-foreground" />;
  };

  return (
    <Card className="glassmorphic border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UploadCloud className="h-5 w-5 text-primary" />
          Upload Document
        </CardTitle>
        <CardDescription>Attach a file for AI summarization or analysis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input Trigger Area */}
        {!selectedFile && !isUploading && (
          <Button
            variant="outline"
            className="w-full h-auto glassmorphic-input border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/10 py-6 flex flex-col items-center justify-center group transition-all duration-200 ease-in-out"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label="Choose file to upload"
          >
            <UploadCloud className="h-10 w-10 text-primary/60 mb-2 group-hover:text-primary transition-colors" />
            <span className="text-base font-medium text-foreground/80 group-hover:text-primary transition-colors">
              Choose File
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {ACCEPTED_FILE_TYPES_DISPLAY} (Max 10MB)
            </span>
          </Button>
        )}
        <Input
          id="file-upload"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          disabled={isUploading}
        />

        {/* Selected File Display (before processing) */}
        {selectedFile && !isUploading && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/50 border border-primary/40 shadow-sm glassmorphic">
            <div className="flex items-center gap-2.5 min-w-0"> {/* min-w-0 for truncate */}
              {getFileIcon()}
              <span className="text-sm font-medium text-foreground truncate" title={selectedFile.name}>
                {selectedFile.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-full"
              onClick={() => {
                setSelectedFile(null);
                setError(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Remove file"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Upload Progress & File Info During Upload */}
        {isUploading && selectedFile && (
          <div className="space-y-2 p-3 rounded-lg bg-card/50 border border-primary/20 shadow-sm glassmorphic">
            <div className="flex items-center gap-2.5 text-sm mb-1">
              {getFileIcon(selectedFile.type, selectedFile.name)}
              <span className="font-medium truncate">{selectedFile.name}</span>
            </div>
            <Progress value={uploadProgress} className="w-full h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-secondary [&>div]:to-primary" />
            <p className="text-xs text-center text-primary font-medium">Processing: {Math.round(uploadProgress)}%</p>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2.5 text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/30 glassmorphic">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full bg-primary/90 hover:bg-primary text-primary-foreground transition-all duration-200 ease-in-out transform hover:scale-[1.02] focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Process with AI
              <UploadCloud className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

