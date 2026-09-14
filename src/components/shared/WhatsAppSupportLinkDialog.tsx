"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDataQuery,
  useDataMutation,
} from "@/lib/tanstack/dataQuery";
import {
  WhatsAppIcon,
  WHATSAPP_SUPPORT_URL,
} from "@/components/shared/WhatsAppSupportButton";

const API_BASE = import.meta.env.VITE_API_URL;

// Mirrors WHATSAPP_ALLOWED_HOSTS in backend appSetting.service.ts — the
// backend re-validates, this just gives the admin a faster message.
const ALLOWED_HOSTS = ["wa.me", "api.whatsapp.com", "chat.whatsapp.com"];

function validateSupportUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter the WhatsApp link, e.g. https://wa.me/15551234567";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full link starting with https:// (e.g. https://wa.me/15551234567)";
  }

  if (parsed.protocol !== "https:") {
    return "The link must start with https://";
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return "The link must point to wa.me, api.whatsapp.com, or chat.whatsapp.com";
  }
  return null;
}

interface WhatsAppSupportLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for viewing and changing the WhatsApp support link.
 *
 * Every "Message us on WhatsApp" button in the app reads the link from
 * GET /api/appSettings/public/whatsapp-support (admin-editable, no code
 * changes needed). The public link is not secret, but only admins can
 * save a new one — the save endpoint (PATCH /api/appSettings/whatsapp-support)
 * requires admin JWT auth.
 */
export function WhatsAppSupportLinkDialog({
  open,
  onOpenChange,
}: WhatsAppSupportLinkDialogProps) {
  const [supportUrl, setSupportUrl] = useState("");

  // Fetch the current link whenever the dialog opens (authed endpoint —
  // admin is signed in; token refresh handled by the data query layer).
  const {
    data: current,
    isLoading,
  } = useDataQuery<{ supportUrl: string }>({
    apiEndPoint: `${API_BASE}/api/appSettings/whatsapp-support`,
    noFilter: true,
    enabled: open,
  });

  useEffect(() => {
    if (open && current?.supportUrl) {
      setSupportUrl(current.supportUrl);
    }
    if (!open) {
      setSupportUrl("");
    }
  }, [open, current?.supportUrl]);

  // Save — invalidates both the public endpoint (drives every WhatsApp
  // button in the app) and the authed one this dialog reads.
  const saveMutation = useDataMutation<
    { supportUrl: string },
    { supportUrl: string }
  >({
    apiEndPoint: `${API_BASE}/api/appSettings/whatsapp-support`,
    method: "PATCH",
    onSuccess: (data) => {
      toast.success("WhatsApp support link updated", {
        description: "Every WhatsApp button now opens the new chat.",
      });
      setSupportUrl(data.supportUrl);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error.message || "Failed to update the WhatsApp support link",
      );
    },
    invalidateQueryKey: [
      ["data", `${API_BASE}/api/appSettings/public/whatsapp-support`],
      ["data", `${API_BASE}/api/appSettings/whatsapp-support`],
    ],
  });

  const handleSave = () => {
    const validationError = validateSupportUrl(supportUrl);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    saveMutation.mutate({ supportUrl: supportUrl.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
            WhatsApp Support Link
          </DialogTitle>
          <DialogDescription>
            Set the WhatsApp click-to-chat link used by every "Message us on
            WhatsApp" button across the app. Change it here whenever it
            rotates — no code changes or redeploy needed.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Support Link
              </Label>
              <Input
                type="url"
                value={supportUrl}
                onChange={(e) => setSupportUrl(e.target.value)}
                placeholder="https://wa.me/15551234567"
                className="h-10 text-sm rounded-xl"
                autoComplete="off"
                name="whatsapp-support-url"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <p className="text-[10px] text-slate-400">
                Accepted: wa.me, api.whatsapp.com, or chat.whatsapp.com links
                (wa.me short links, click-to-chat, or group invites).
              </p>
            </div>

            {supportUrl.trim() && !validateSupportUrl(supportUrl) && (
              <a
                href={supportUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test this link before saving
              </a>
            )}

            {supportUrl.trim() === WHATSAPP_SUPPORT_URL && (
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                This is the current default link.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || isLoading}
            className="lime-btn rounded-xl"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <WhatsAppIcon className="w-4 h-4 mr-2" />
                Save Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
