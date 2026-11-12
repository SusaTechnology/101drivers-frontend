"use client";

import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Camera } from "lucide-react";
import { useFileUpload } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

interface PhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  title: string;
  /** Show the Download button */
  showDownload?: boolean;
  /** Show the Update Photo button and handle file upload */
  showUpdate?: boolean;
  /** Loading state for upload (optional, managed externally) */
  uploading?: boolean;
  /** Callback when user clicks Download */
  onDownload?: (src: string, title: string) => void;
  /** Callback when user clicks Update Photo (e.g., trigger file picker) */
  onUpdate?: () => void;
}

export function PhotoDialog({
  open,
  onOpenChange,
  src,
  title,
  showDownload = false,
  showUpdate = false,
  uploading = false,
  onDownload,
  onUpdate,
}: PhotoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>
            {!showDownload && !showUpdate && "View this photo."}
            {(showDownload || showUpdate) && "View this photo."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <img
            src={src}
            alt={title}
            className="max-w-full max-h-[60vh] object-contain rounded-xl"
          />
          {(showDownload || showUpdate) && (
            <div className="flex gap-3">
              {showDownload && onDownload && (
                <Button
                  variant="outline"
                  onClick={() => onDownload(src, title)}
                  className="rounded-xl"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download
                </Button>
              )}
              {showUpdate && onUpdate && (
                <Button
                  onClick={onUpdate}
                  disabled={uploading}
                  className="rounded-xl"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  {uploading ? "Uploading..." : "Update Photo"}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface UsePhotoUploadReturn {
  /** Ref to attach to a hidden <input type="file"> */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** JSX element: hidden file input */
  HiddenFileInput: JSX.Element;
  /** Whether upload is in progress */
  uploading: boolean;
  /** The uploaded URL (null until upload completes) */
  pendingUrl: string | null;
  /** Clear the pending URL */
  clearPending: () => void;
}

export function usePhotoUpload(uploadEndpoint: string): UsePhotoUploadReturn {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);

  const upload = useFileUpload<{ ok: boolean; url: string }>(uploadEndpoint, {
    onSuccess: (data) => {
      if (data.url) {
        setPendingUrl(data.url);
        toast.success("Photo uploaded successfully");
      }
    },
    onError: () => toast.error("Failed to upload photo"),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    upload.mutate(formData);
    e.target.value = "";
  };

  const triggerPicker = () => {
    inputRef.current?.click();
  };

  return {
    inputRef,
    HiddenFileInput: (
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    ),
    uploading: upload.isPending,
    pendingUrl,
    clearPending: () => setPendingUrl(null),
  };
}

/**
 * Downloads an image as a file by fetching it as a blob.
 * Shows error toast if download fails.
 */
export async function downloadImageAsFile(
  url: string,
  filename: string
): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename + ".jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("Download failed", {
      description: "Could not download the image. Try right-clicking and saving.",
    });
  }
}
