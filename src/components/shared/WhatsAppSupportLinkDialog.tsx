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
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  MediumIcon,
  PinterestIcon,
  SubstackIcon,
  ThreadsIcon,
  TiktokIcon,
  XIcon,
  YelpIcon,
  YoutubeIcon,
  BRAND_COLORS,
} from "@/components/shared/BrandIcons";

const API_BASE = import.meta.env.VITE_API_URL;

// Mirrors WHATSAPP_ALLOWED_HOSTS in backend appSetting.service.ts — the
// backend re-validates, this just gives the admin a faster message.
const ALLOWED_HOSTS = ["wa.me", "api.whatsapp.com", "chat.whatsapp.com"];

// ── Optional social media profiles ───────────────────────────────────
// Mirrors SOCIAL_LINK_PLATFORMS in backend appSetting.dto.ts. Every field
// is OPTIONAL: an empty field means "we don't use this platform" and it
// is omitted everywhere a link would render. Each row carries the
// platform's real brand logo (Icon) + its brand color class so the admin
// recognizes the platform at a glance.
// The full American-company set lives here so ops never needs a code
// change to add a profile — paste the link, save, done.
const SOCIAL_FIELDS = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/101drivers",
    Icon: InstagramIcon,
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/101drivers",
    Icon: FacebookIcon,
  },
  {
    key: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/101drivers",
    Icon: XIcon,
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@101drivers",
    Icon: YoutubeIcon,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/company/101drivers",
    Icon: LinkedinIcon,
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@101drivers",
    Icon: TiktokIcon,
  },
  {
    key: "threads",
    label: "Threads",
    placeholder: "https://threads.net/@101drivers",
    Icon: ThreadsIcon,
  },
  {
    key: "pinterest",
    label: "Pinterest",
    placeholder: "https://pinterest.com/101drivers",
    Icon: PinterestIcon,
  },
  {
    key: "medium",
    label: "Medium",
    placeholder: "https://medium.com/@101drivers",
    Icon: MediumIcon,
  },
  {
    key: "substack",
    label: "Substack",
    placeholder: "https://101drivers.substack.com",
    Icon: SubstackIcon,
  },
  {
    key: "yelp",
    label: "Yelp",
    placeholder: "https://yelp.com/biz/101-drivers",
    Icon: YelpIcon,
  },
] as const;

type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];
type SocialState = Partial<Record<SocialKey, string>>;

interface WhatsappSocialSettings {
  supportUrl: string;
  social?: Partial<Record<SocialKey, string | null>>;
}

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

/**
 * Optional-field validator: empty = platform not used (always fine),
 * otherwise the link must be a full https:// URL. The backend applies
 * the same rule — this just surfaces it instantly in the dialog.
 */
function validateOptionalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full link starting with https://";
  }

  if (parsed.protocol !== "https:") {
    return "Must start with https://";
  }
  return null;
}

interface WhatsAppSupportLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wide dialog for viewing and changing the WhatsApp support link AND the
 * company's optional social media profile links (the admin Config Hub
 * "WhatsApp & Social Links" card).
 *
 * Layout: the title is pinned to the top and the action buttons are
 * pinned to the bottom of the dialog; only the middle section scrolls,
 * and only when the viewport is too short (small screens) — on a normal
 * desktop everything fits without scrolling.
 *
 * The WhatsApp link backs every "Message us on WhatsApp" button in the
 * app AND the ready-to-open deep link in the customer delivery emails —
 * the base link always comes from the DB (never hardcoded), so rotating
 * it here instantly re-targets every button and future emails. Social
 * profiles are admin-side settings only; customer emails stay
 * WhatsApp-only.
 *
 * Both are read from GET /api/appSettings/whatsapp-support and saved via
 * PATCH (admin-only). The public link is not secret, but only admins can
 * save a new one.
 */
export function WhatsAppSupportLinkDialog({
  open,
  onOpenChange,
}: WhatsAppSupportLinkDialogProps) {
  const [supportUrl, setSupportUrl] = useState("");
  const [social, setSocial] = useState<SocialState>({});

  // Fetch the current settings whenever the dialog opens (authed endpoint
  // — admin is signed in; token refresh handled by the data query layer).
  const {
    data: current,
    isLoading,
  } = useDataQuery<WhatsappSocialSettings>({
    apiEndPoint: `${API_BASE}/api/appSettings/whatsapp-support`,
    noFilter: true,
    enabled: open,
  });

  useEffect(() => {
    if (open && current?.supportUrl) {
      setSupportUrl(current.supportUrl);
      const stored: SocialState = {};
      for (const field of SOCIAL_FIELDS) {
        const value = current.social?.[field.key];
        stored[field.key] = typeof value === "string" ? value : "";
      }
      setSocial(stored);
    }
    if (!open) {
      setSupportUrl("");
      setSocial({});
    }
  }, [open, current?.supportUrl]);

  // Save — invalidates both the public endpoint (drives every WhatsApp
  // button in the app) and the authed one this dialog reads.
  const saveMutation = useDataMutation<
    WhatsappSocialSettings,
    { supportUrl: string; social: SocialState }
  >({
    apiEndPoint: `${API_BASE}/api/appSettings/whatsapp-support`,
    method: "PATCH",
    onSuccess: (data) => {
      toast.success("WhatsApp & social links updated", {
        description:
          "Every WhatsApp button and future customer delivery emails now use the new chat link.",
      });
      setSupportUrl(data.supportUrl);
      const saved: SocialState = {};
      for (const field of SOCIAL_FIELDS) {
        const value = data.social?.[field.key];
        saved[field.key] = typeof value === "string" ? value : "";
      }
      setSocial(saved);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update the links",
      );
    },
    invalidateQueryKey: [
      ["data", `${API_BASE}/api/appSettings/public/whatsapp-support`],
      ["data", `${API_BASE}/api/appSettings/whatsapp-support`],
    ],
  });

  const supportUrlError = validateSupportUrl(supportUrl);
  const socialErrors: Partial<Record<SocialKey, string | null>> = {};
  let hasSocialError = false;
  for (const field of SOCIAL_FIELDS) {
    const error = validateOptionalUrl(social[field.key] ?? "");
    socialErrors[field.key] = error;
    if (error) hasSocialError = true;
  }

  const handleSave = () => {
    const validationError = validateSupportUrl(supportUrl);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (hasSocialError) {
      toast.error("One or more social links are invalid — fix the red fields first");
      return;
    }

    const payload: SocialState = {};
    for (const field of SOCIAL_FIELDS) {
      payload[field.key] = (social[field.key] ?? "").trim();
    }
    saveMutation.mutate({ supportUrl: supportUrl.trim(), social: payload });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wide dialog: title pinned top, buttons pinned bottom, only the
          middle scrolls when the viewport is too short. */}
      <DialogContent className="sm:max-w-4xl flex flex-col max-h-[92vh] overflow-hidden p-0 gap-0">
        {/* ── Fixed header ── */}
        <DialogHeader className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2.5">
            <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
            WhatsApp &amp; Social Links
          </DialogTitle>
          <DialogDescription>
            The WhatsApp link powers every "Message us on WhatsApp" button and
            the ready-to-open chat link in customer delivery emails (emails
            are WhatsApp-only). Social profiles are optional and internal.
            Change any of it here — no code changes or redeploy needed.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable body (scrolls only on short/small screens) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* ── WhatsApp support link (required, backs every button) ── */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  WhatsApp Support Link
                </Label>
                <div className="relative">
                  <WhatsAppIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#25D366] pointer-events-none" />
                  <Input
                    type="url"
                    value={supportUrl}
                    onChange={(e) => setSupportUrl(e.target.value)}
                    placeholder="https://wa.me/15551234567"
                    className="h-11 pl-10 text-sm rounded-xl"
                    autoComplete="off"
                    name="whatsapp-support-url"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Accepted: wa.me, api.whatsapp.com, or chat.whatsapp.com links.
                  For the customer emails use a wa.me number link (e.g.
                  https://wa.me/14243132168) so the pre-filled question message
                  opens with your pickup address.
                </p>
              </div>

              {supportUrl.trim() && !supportUrlError && (
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

              {/* ── Social media profiles (all optional) ── */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Social Media Profiles — optional
                  </Label>
                  <p className="text-[10px] text-slate-400">
                    Paste the full https:// link for each platform your company
                    uses. Leave a field empty if you don't use that platform.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 mt-3">
                  {SOCIAL_FIELDS.map((field) => {
                    const { Icon } = field;
                    return (
                      <div key={field.key} className="space-y-1">
                        <Label
                          htmlFor={`social-${field.key}`}
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                        >
                          <Icon
                            className={`w-3.5 h-3.5 ${BRAND_COLORS[field.key] ?? ""}`}
                          />
                          {field.label}
                        </Label>
                        <div className="relative">
                          <Icon
                            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                              BRAND_COLORS[field.key] ?? "text-slate-400"
                            }`}
                          />
                          <Input
                            id={`social-${field.key}`}
                            type="url"
                            value={social[field.key] ?? ""}
                            onChange={(e) =>
                              setSocial((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder={field.placeholder}
                            className="h-10 pl-9 text-sm rounded-xl"
                            autoComplete="off"
                            name={`social-${field.key}`}
                          />
                        </div>
                        {socialErrors[field.key] ? (
                          <p className="text-[10px] text-red-500">
                            {socialErrors[field.key]}
                          </p>
                        ) : (
                          (social[field.key] ?? "").trim() && (
                            <a
                              href={social[field.key]!.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Test this link before saving
                            </a>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed footer (buttons stay visible even when the body scrolls) ── */}
        <DialogFooter className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-6 py-4">
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
                Save Links
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
