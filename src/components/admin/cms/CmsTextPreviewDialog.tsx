import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renderCmsInline } from "@/lib/cms-inline";

/**
 * Draft preview for the paragraph-style sections (news announcements and
 * job postings). Renders with the shared inline formatter and the same
 * styling as the public detail pages, so what the admin sees in the dialog
 * is what visitors will read.
 */
export function CmsTextPreviewDialog({
  open,
  onOpenChange,
  title,
  metaLine,
  imageUrl,
  paragraphs,
  emptyHint = "Nothing to preview yet — the body is empty.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  metaLine?: string;
  imageUrl?: string;
  paragraphs: string[];
  emptyHint?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-black">
            {title || "(untitled)"}
          </DialogTitle>
          {metaLine && (
            <DialogDescription className="text-left">
              {metaLine}
            </DialogDescription>
          )}
        </DialogHeader>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Cover preview"
            className="aspect-video w-full rounded-xl object-cover"
          />
        )}
        <div className="space-y-4">
          {paragraphs.length === 0 && (
            <p className="text-sm text-slate-400">{emptyHint}</p>
          )}
          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              {renderCmsInline(paragraph)}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
