import { useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveCmsAssetUrl, useCmsMediaUpload } from "@/lib/cms";

/**
 * Cover-image field for the CMS editors.
 *
 * - Click / drop an image → uploads to the CMS media library
 *   (POST /api/cms/admin/media) → stores the returned URL on the draft.
 * - Shows a live preview with alt-text + remove.
 * - Upload errors surface as toasts (auth refresh handled by useFileUpload).
 */

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";
const MAX_MB = 8;

interface CmsImageFieldProps {
  value?: string | null;
  alt?: string;
  label?: string;
  onChange: (patch: { url: string | null; alt?: string }) => void;
}

export function CmsImageField({ value, alt, label = "Cover image", onChange }: CmsImageFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useCmsMediaUpload();

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPTED.split(",").includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Images must be smaller than ${MAX_MB} MB.`);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    upload.mutate(formData, {
      onSuccess: (data) => {
        toast.success("Image uploaded");
        onChange({ url: data.url, alt });
      },
      onError: (error: Error) => {
        toast.error(error.message || "Image upload failed — please try again.");
      },
    });
  };

  const preview = resolveCmsAssetUrl(value);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </Label>

      {preview ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900">
          <img
            src={preview}
            alt={alt || "Cover preview"}
            className="aspect-video w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 p-2 border-t border-slate-200 dark:border-slate-800">
            <Input
              value={alt ?? ""}
              onChange={(e) => onChange({ url: value ?? null, alt: e.target.value })}
              placeholder="Describe the image for screen readers and SEO (alt text)"
              className="h-9 text-xs flex-1"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                disabled={upload.isPending}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs text-red-600 hover:text-red-700"
                disabled={upload.isPending}
                onClick={() => onChange({ url: null, alt: "" })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-500/5 transition-colors p-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 cursor-pointer disabled:opacity-60"
        >
          {upload.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-lime-600" />
          ) : (
            <ImagePlus className="h-6 w-6 text-lime-600" />
          )}
          <span className="text-sm font-semibold">
            {upload.isPending ? "Uploading…" : "Click to upload or drag an image here"}
          </span>
          <span className="text-xs">JPEG, PNG, WebP or GIF — up to {MAX_MB} MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
