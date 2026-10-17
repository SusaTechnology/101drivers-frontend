import { useDataQuery } from "@/lib/tanstack/dataQuery";

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
} from "./BrandIcons";
import { WHATSAPP_SUPPORT_URL, WhatsAppIcon } from "./WhatsAppSupportButton";

/**
 * SocialLinks — the footer social icon row.
 *
 * SINGLE SOURCE OF TRUTH = DATABASE. The links come from the same public
 * settings endpoint the WhatsApp buttons already use:
 *   GET /api/appSettings/public/whatsapp-support → { supportUrl, social }
 * where `social` is the admin-editable platform map (Admin > Config Hub >
 * "WhatsApp & Social Links"). Rotating a profile there updates this row on
 * the next fetch — no code change or redeploy.
 *
 * Behavior:
 *  - While the fetch is loading or fails, the row renders the historical
 *    hardcoded set below (same contract as useWhatsAppSupportUrl's
 *    fallback) so the footer never renders blank or dead.
 *  - Once loaded, the DB map wins verbatim: platforms the admin cleared
 *    (null) are omitted, platforms they add appear automatically.
 *  - The WhatsApp icon always uses supportUrl (it is not part of the
 *    social map — it backs every "Message us on WhatsApp" button too).
 *
 * The endpoint/params MUST stay identical to useWhatsAppSupportUrl in
 * WhatsAppSupportButton.tsx — identical React Query keys share one cache
 * entry, so both consumers cost a single network request.
 */

/** Same platform set + order as SOCIAL_LINK_PLATFORMS in appSetting.dto.ts. */
const PLATFORM_META: Record<
  string,
  { label: string; Icon: (props: { className?: string }) => React.ReactNode }
> = {
  instagram: { label: "Instagram", Icon: InstagramIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
  x: { label: "X (Twitter)", Icon: XIcon },
  youtube: { label: "YouTube", Icon: YoutubeIcon },
  linkedin: { label: "LinkedIn", Icon: LinkedinIcon },
  tiktok: { label: "TikTok", Icon: TiktokIcon },
  threads: { label: "Threads", Icon: ThreadsIcon },
  pinterest: { label: "Pinterest", Icon: PinterestIcon },
  medium: { label: "Medium", Icon: MediumIcon },
  substack: { label: "Substack", Icon: SubstackIcon },
  yelp: { label: "Yelp", Icon: YelpIcon },
};

const PLATFORM_ORDER = Object.keys(PLATFORM_META);

/** Historical profiles — fallback only (loading / fetch failure). */
const FALLBACK_SOCIAL: Array<{ key: string; href: string }> = [
  { key: "instagram", href: "https://www.instagram.com/101drivers" },
  { key: "x", href: "https://x.com/101drivers" },
  { key: "youtube", href: "https://www.youtube.com/@101Drivers" },
];

type PublicSocialSettings = {
  supportUrl?: string;
  social?: Record<string, string | null> | null;
};

function usePublicSocialSettings() {
  return useDataQuery<PublicSocialSettings>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/appSettings/public/whatsapp-support`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true, // public endpoint — no token refresh on 401
    staleTime: 5 * 60 * 1000,
  });
}

export function SocialLinks({ className = "" }: { className?: string }) {
  const { data } = usePublicSocialSettings();

  const supportUrl = data?.supportUrl || WHATSAPP_SUPPORT_URL;
  const social = data?.social ?? null;

  const entries: Array<{
    key: string;
    label: string;
    href: string;
    Icon: (props: { className?: string }) => React.ReactNode;
  }> = [];

  if (social) {
    // DB is the source of truth — render exactly what is stored, in the
    // stable platform order; unset/cleared platforms are omitted.
    for (const key of PLATFORM_ORDER) {
      const href = social[key];
      if (typeof href === "string" && href.trim()) {
        entries.push({ key, href, ...PLATFORM_META[key] });
      }
    }
  } else {
    // Loading or failed fetch — the historical set keeps the footer alive.
    for (const { key, href } of FALLBACK_SOCIAL) {
      entries.push({ key, href, ...PLATFORM_META[key] });
    }
  }

  if (supportUrl) {
    entries.push({
      key: "whatsapp",
      label: "WhatsApp",
      href: supportUrl,
      Icon: WhatsAppIcon,
    });
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {entries.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-lime-500 hover:border-lime-500 hover:text-slate-950 transition-colors"
        >
          <Icon className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}
