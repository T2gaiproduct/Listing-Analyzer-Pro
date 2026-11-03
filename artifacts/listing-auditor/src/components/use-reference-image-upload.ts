import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_FILE_SIZE = 1024;
const MIN_WIDTH = 256;
const MIN_HEIGHT = 256;

export function useReferenceImageUpload(
  images: string[],
  onImagesChange: (images: string[]) => void,
  maxImages: number,
) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const canAddMore = images.length < maxImages;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({
        title: "Reference limit reached",
        description: `You can attach up to ${maxImages} images.`,
        variant: "destructive",
      });
      return;
    }

    const rawFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining);
    if (rawFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please upload image files only.", variant: "destructive" });
      return;
    }

    const validFiles: File[] = [];
    for (const file of rawFiles) {
      if (file.size < MIN_FILE_SIZE) {
        toast({
          title: "Image too small",
          description: `"${file.name}" may be corrupted or too low quality.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Image too large", description: `"${file.name}" exceeds the 20 MB limit.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    setIsUploading(true);
    const results: string[] = [];
    let checks = 0;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
            toast({
              title: "Image too small",
              description: `"${file.name}" is ${img.width}×${img.height}. Minimum ${MIN_WIDTH}×${MIN_HEIGHT}px recommended.`,
              variant: "destructive",
            });
          } else {
            results.push(dataUrl);
          }
          checks++;
          if (checks === validFiles.length) {
            if (results.length > 0) {
              onImagesChange([...images, ...results].slice(0, maxImages));
            }
            setIsUploading(false);
          }
        };
        img.onerror = () => {
          toast({ title: "Invalid image", description: `"${file.name}" could not be loaded.`, variant: "destructive" });
          checks++;
          if (checks === validFiles.length) {
            if (results.length > 0) {
              onImagesChange([...images, ...results].slice(0, maxImages));
            }
            setIsUploading(false);
          }
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        checks++;
        if (checks === validFiles.length) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const openFilePicker = () => {
    if (!canAddMore || isUploading) return;
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    handleFiles,
    isUploading,
    canAddMore,
    openFilePicker,
    removeImage,
  };
}
