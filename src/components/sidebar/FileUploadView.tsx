"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, ImageIcon, FileType, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface FileUploadViewProps {
  onFileUpload: (fileDataUri: string, fileName: string, fileType: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ".txt,.jpg,.jpeg,.png,.pdf";

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
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      // Basic type check based on extension
      const fileExtension = "." + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_FILE_TYPES.split(',').includes(fileExtension)) {
        setError(`Invalid file type. Accepted: ${ACCEPTED_FILE_TYPES}`);
        setSelectedFile(null);
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

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        setUploadProgress(progress);
      } else {
        clearInterval(interval);
      }
    }, 100);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        clearInterval(interval);
        setUploadProgress(100);
        onFileUpload(reader.result as string, selectedFile.name, selectedFile.type);
        toast({
          title: "File Ready",
          description: `${selectedFile.name} processed and ready for AI.`,
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      };
      reader.onerror = () => {
        clearInterval(interval);
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
      clearInterval(interval);
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

  const getFileIcon = () => {
    if (!selectedFile) return <FileType className="h-6 w-6 text-muted-foreground" />;
    if (selectedFile.type.startsWith("image/")) return <ImageIcon className="h-6 w-6 text-primary" />;
    if (selectedFile.type === "application/pdf") return <FileText className="h-6 w-6 text-red-500" />; // Lucide doesn't have a PDF icon
    if (selectedFile.type === "text/plain") return <FileText className="h-6 w-6 text-green-500" />;
    return <FileType className="h-6 w-6 text-muted-foreground" />;
  };

  return (
    <Card className="glassmorphic border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UploadCloud className="h-5 w-5 text-primary" />
          Upload Document
        </CardTitle>
        <CardDescription>Supports .txt, .jpg, .png, .pdf (max 10MB).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Choose file</Label>
          <Input
            id="file-upload"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={ACCEPTED_FILE_TYPES}
            className="glassmorphic-input file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
            disabled={isUploading}
          />
        </div>

        {selectedFile && !isUploading && (
          <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-muted/30">
            {getFileIcon()}
            <span className="text-sm truncate">{selectedFile.name}</span>
          </div>
        )}

        {isUploading && (
          <div className="space-y-1">
            <Progress value={uploadProgress} className="w-full h-2 [&>div]:bg-gradient-to-r [&>div]:from-secondary [&>div]:to-primary" />
            <p className="text-xs text-center text-primary">Processing: {uploadProgress}%</p>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive p-2 rounded-md bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <p>{error}</p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full bg-primary/80 hover:bg-primary text-primary-foreground"
        >
          {isUploading ? "Processing..." : "Process with AI"}
          <UploadCloud className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
