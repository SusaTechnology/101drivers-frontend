import { Instagram, Youtube } from "lucide-react";

import { WhatsAppIcon } from "./WhatsAppSupportButton";

/**
 * X (formerly Twitter) brand mark — lucide only ships the retired bird
 * logo, and the profile is x.com/101drivers.
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIAL_LINKS: Array<{
  label: string;
  href: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}> = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/101drivers",
    Icon: ({ className }) => <Instagram className={className} />,
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/101drivers",
    Icon: XIcon,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@101Drivers",
    Icon: ({ className }) => <Youtube className={className} />,
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/message/YQXTDFV6STKUP1",
    Icon: ({ className }) => <WhatsAppIcon className={className} />,
  },
];

/**
 * SocialLinks — the footer social icon row (Instagram / X / YouTube /
 * WhatsApp). Rendered below the footer link sections, above the legal
 * line, on every public footer.
 */
export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {SOCIAL_LINKS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-lime-500 hover:border-lime-500 hover:text-slate-950 transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}
