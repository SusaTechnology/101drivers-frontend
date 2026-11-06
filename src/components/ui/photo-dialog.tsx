"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Camera, RotateCw } from "lucide-react";
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
  // View-only rotation (90° steps) — license photos frequently arrive
  // sideways and the admin needs to READ them, not just see them.
  // Deliberately NOT persisted: these images are evidence (license,
  // selfie, delivery proof); overwriting the stored file from a viewer
  // would silently rewrite what was submitted. Reset whenever the dialog
  // opens or the image swaps (front → back) so a stale angle never leaks
  // into the next photo.
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setRotation(0);
  }, [src, open]);

  // A 90°/270° rotation swaps the image's visual width and height, but a
  // transform never changes the layout box — a wide license photo rotated
  // upright would overflow the dialog horizontally. Constraining the
  // layout box to ≤60vh on the long edge while sideways keeps the rotated
  // result inside the same area the unrotated image occupied.
  const sideways = rotation % 180 !== 0;

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
            className={`object-contain rounded-xl transition-transform duration-200 max-h-[60vh] ${
              sideways ? "max-w-[60vh]" : "max-w-full"
            }`}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="rounded-xl"
              aria-label="Rotate photo 90 degrees clockwise"
            >
              <RotateCw className="w-4 h-4 mr-1.5" />
              Rotate
            </Button>
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
