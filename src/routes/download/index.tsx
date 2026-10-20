// routes/download/index.tsx
//
// PUBLIC smart link the mobile-only signup QR code points at
// (101drivers.com/download). A phone opens this page, the page detects
// the PHONE's OS from its user agent — never screen size — and forwards
// to the right store. Desktop visitors get both store buttons.
//
// Store URLs come from build-time env vars:
//   VITE_APP_STORE_URL   (iOS — App Store listing)
//   VITE_PLAY_STORE_URL  (Android — Google Play listing)
// Until they are set, the page renders a friendly "apps are launching"
// card instead of bouncing anyone to a dead link, so the QR code is
// safe to print from day one.

import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Apple, Play, Globe, Smartphone } from "lucide-react";

import { Brand } from "@/lib/items/brand";

const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || "";
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || "";

type PhoneOs = "ios" | "android" | "other";

function detectPhoneOs(userAgent: string): PhoneOs {
  const ua = (userAgent || "").toString();
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function DownloadPage() {
  const phoneOs = useMemo(
    () => detectPhoneOs(typeof navigator !== "undefined" ? navigator.userAgent : ""),
    []
  );

  const storeUrl =
    phoneOs === "ios" ? APP_STORE_URL : phoneOs === "android" ? PLAY_STORE_URL : "";

  // Forward a phone straight to its store (when configured). The card
  // below stays as the fallback while the redirect runs.
  useEffect(() => {
    if (storeUrl) {
      window.location.replace(storeUrl);
    }
  }, [storeUrl]);

  const buttons: { href: string; label: string; icon: typeof Apple }[] = [];
  if (APP_STORE_URL) {
    buttons.push({ href: APP_STORE_URL, label: "Download on the App Store", icon: Apple });
  }
  if (PLAY_STORE_URL) {
    buttons.push({ href: PLAY_STORE_URL, label: "Get it on Google Play", icon: Play });
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-sm p-6 sm:p-8 text-center space-y-5">
        <div className="flex justify-center">
          <Brand />
        </div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>

        {storeUrl ? (
          <p className="text-sm text-muted-foreground">
            Taking you to the{" "}
            {phoneOs === "ios" ? "App Store" : "Google Play"}…
          </p>
        ) : buttons.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Get the 101 Drivers app</p>
            {buttons.map((b) => (
              <a
                key={b.label}
                href={b.href}
                className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <b.icon className="h-4 w-4" />
                {b.label}
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Our mobile apps are on the way</p>
            <p className="text-sm text-muted-foreground">
              The 101 Drivers app isn&apos;t in the stores yet — keep an eye
              on this page. Meanwhile, everything lives at 101drivers.com.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Globe className="h-4 w-4" />
              Go to 101drivers.com
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/download/")({
  component: DownloadPage,
});
