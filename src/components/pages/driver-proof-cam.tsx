import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROOF_CAM_FLAG = "hasSeenProofCam";

type PermissionCheck = { granted: boolean; detail: string };
type GeoPermissionState = "granted" | "denied" | "prompt" | null;

const CAMERA_BLOCKED_DETAIL =
  "Camera access is blocked. Allow camera for this site in your browser (or phone) settings, then tap Retry.";
const LOCATION_BLOCKED_DETAIL =
  "Location access is blocked. Allow location for this site in your browser (or phone) settings, then tap Retry.";
// Shown when the Permissions API reports the site is ALREADY denied: no popup
// will EVER appear until the driver changes settings — this is the answer to
// "the location permission alert is not coming".
const LOCATION_NO_POPUP_DETAIL =
  "No popup can appear — location is already set to Block for this app in your browser. Turn location on in your phone or browser settings (steps above), then tap Retry.";

// Best-effort read of the site-level permission state. null = unsupported
// (older Safari/webviews) — callers must fall back to the request-based path.
const geoPermissionState = async (): Promise<GeoPermissionState> => {
  try {
    if (!navigator.permissions?.query) return null;
    const status = await navigator.permissions.query({ name: "geolocation" });
    return (status.state as "granted" | "denied" | "prompt") ?? null;
  } catch {
    return null;
  }
};

export default function DriverProofCamPage() {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [camCheck, setCamCheck] = useState<PermissionCheck | null>(null);
  const [locCheck, setLocCheck] = useState<PermissionCheck | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  // Fallback ONLY: set when the browser silently refused to show the location
  // popup in the same tap (the camera prompt consumed the tap's user
  // activation — no popup, instant PERMISSION_DENIED, which drivers read as
  // "it's not even asking me"). The next tap gives the prompt a fresh gesture.
  const [awaitingLocation, setAwaitingLocation] = useState(false);
  const navigate = useNavigate();

  // On mount: if already seen, redirect to dashboard
  useEffect(() => {
    try {
      const seen = localStorage.getItem(PROOF_CAM_FLAG);
      if (seen === "true") {
        navigate({ to: "/driver/dashboard" });
      }
    } catch {
      // localStorage may not be available (SSR, private browsing, etc.)
    }
  }, [navigate]);

  // ── CAMERA ────────────────────────────────────────────────────────────────
  // Only NotAllowedError / SecurityError mean the driver said "no". Device-level
  // failures (no camera, camera busy, missing back camera) are NOT permission
  // denials — trapping the driver on this screen for those is wrong; the proof
  // photo flow itself will surface a real error if the camera is unusable.
  const checkCameraPermission = async (): Promise<PermissionCheck> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // Insecure context (http) or a webview without camera support.
      return {
        granted: false,
        detail:
          "This browser can't open the camera. Please open the app in Safari (iPhone) or Chrome (Android).",
      };
    }
    const openCamera = async (video: MediaTrackConstraints | boolean) => {
      const stream = await navigator.mediaDevices.getUserMedia({ video });
      // Stop the stream immediately — we just needed permission
      stream.getTracks().forEach((track) => track.stop());
    };
    try {
      await openCamera({ facingMode: "environment" });
      return { granted: true, detail: "" };
    } catch (err: any) {
      const name = err?.name ?? "";
      // No back-facing camera (e.g. desktops) — any camera proves the permission.
      if (name === "OverconstrainedError") {
        try {
          await openCamera(true);
          return { granted: true, detail: "" };
        } catch (retryErr: any) {
          const retryName = retryErr?.name ?? "";
          if (retryName === "NotAllowedError" || retryName === "SecurityError") {
            return { granted: false, detail: CAMERA_BLOCKED_DETAIL };
          }
          return { granted: true, detail: "" };
        }
      }
      if (name === "NotAllowedError" || name === "SecurityError") {
        return { granted: false, detail: CAMERA_BLOCKED_DETAIL };
      }
      // NotFoundError (no camera), NotReadableError (camera busy) etc.:
      // permission itself is fine — let the driver in.
      return { granted: true, detail: "" };
    }
  };

  // ── LOCATION ──────────────────────────────────────────────────────────────
  // GeolocationPositionError code 1 (PERMISSION_DENIED) is the ONLY signal that
  // the driver said "no". Codes 2/3 (POSITION_UNAVAILABLE / TIMEOUT) mean the
  // permission IS granted but the device couldn't produce a fix right now —
  // indoors, weak GPS, desktop without a location source. Route tracking
  // retries continuously on the job screens, so this gate must not trap
  // drivers whose permission was allowed but whose fix is slow/unavailable.
  //
  // The Permissions API is consulted when available, and code 1 is
  // DISAGGREGATED so a missing popup is never reported as a refusal:
  //   state 'denied' pre-check → the prompt can never appear; report that
  //                     precisely (no popup until settings change).
  //   code 1 + still
  //   'prompt'/no API  → the popup was NEVER painted (silent auto-deny —
  //                     the camera prompt consumed this tap's activation);
  //                     retry from a fresh tap, never blame the driver.
  //   code 1 + 'denied' → a real popup was refused → settings message.
  //   code 1 on the fresh-activation tap (final) → genuine block.
  type LocationAttempt =
    | { outcome: "granted" }
    | { outcome: "needs-tap" }
    | { outcome: "blocked"; detail: string };

  const attemptLocation = async (final: boolean): Promise<LocationAttempt> => {
    if (!("geolocation" in navigator)) {
      return {
        outcome: "blocked",
        detail:
          "This browser has no location support. Please open the app in Safari or Chrome.",
      };
    }
    const state = await geoPermissionState();
    if (state === "denied") {
      return { outcome: "blocked", detail: LOCATION_NO_POPUP_DETAIL };
    }
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000, // accept a fix up to 5 min old → fast resolve
        });
      });
      return { outcome: "granted" };
    } catch (err: any) {
      if (err?.code === 1) {
        if (final) {
          // Fresh gesture and still refused — a real denial.
          return { outcome: "blocked", detail: LOCATION_BLOCKED_DETAIL };
        }
        const stateNow = await geoPermissionState();
        if (stateNow === "prompt" || stateNow === null) {
          // The site setting is still "ask" → no popup was ever painted.
          // Hand the ask its own tap (fresh user activation), silently.
          return { outcome: "needs-tap" };
        }
        // State flipped to 'denied' → the driver refused a real popup.
        return { outcome: "blocked", detail: LOCATION_BLOCKED_DETAIL };
      }
      // Allowed but no fix available — pass the gate.
      return { outcome: "granted" };
    }
  };

  const finishAndEnter = () => {
    try {
      localStorage.setItem(PROOF_CAM_FLAG, "true");
    } catch {
      // Storage may not be available
    }
    navigate({ to: "/driver/dashboard" });
  };

  const GENERIC_PERMISSION_ERROR =
    "Camera and location access are required for deliveries. Please fix the item marked ✗ above and tap Retry.";

  const handleContinue = async () => {
    setPermissionError(null);
    setIsRequesting(true);

    try {
      // ── Fallback second tap: the location prompt gets a FRESH gesture ──
      if (awaitingLocation) {
        setAwaitingLocation(false);
        const attempt = await attemptLocation(true);
        if (attempt.outcome === "granted") {
          setLocCheck({ granted: true, detail: "" });
          finishAndEnter();
        } else if (attempt.outcome === "blocked") {
          setLocCheck({ granted: false, detail: attempt.detail });
          setPermissionError(GENERIC_PERMISSION_ERROR);
        } else {
          // Unreachable with final=true (needs-tap only comes from the
          // non-final attempt) — stay unstuck instead of blaming.
          setAwaitingLocation(true);
        }
        return;
      }

      // ── First tap: camera popup, then the location popup right after ──
      setCamCheck(null);
      setLocCheck(null);

      // Sequential so the two native prompts never collide on iOS Safari.
      const cam = await checkCameraPermission();
      setCamCheck(cam);
      if (!cam.granted) {
        setPermissionError(GENERIC_PERMISSION_ERROR);
        return;
      }

      // ONE tap, BOTH popups: the moment the camera prompt resolves, the
      // location prompt fires in the same gesture. If the browser silently
      // refused the second popup (activation spent on the camera prompt),
      // the attempt reports needs-tap instead of blaming the driver.
      const attempt = await attemptLocation(false);
      if (attempt.outcome === "granted") {
        setLocCheck({ granted: true, detail: "" });
        finishAndEnter();
        return;
      }
      if (attempt.outcome === "needs-tap") {
        setAwaitingLocation(true);
        return;
      }
      setLocCheck({ granted: false, detail: attempt.detail });
      setPermissionError(GENERIC_PERMISSION_ERROR);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col">
      {/* Back link top-left */}
      <div className="sticky top-0 p-6">
        <Link
          to="/home"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-snug">
            Proof Camera
          </h1>

          {/* --- Beautiful, safe content --- */}
<div className="space-y-6 text-left text-slate-700 dark:text-slate-200 leading-relaxed">
  {/* Why it matters */}
  <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
      📸 How Proof Camera works
    </h2>
    <p className="text-base">

      Your phone <strong>is</strong> your proof camera. You’ll take six photos 
      at the pickup location and six photos at the drop-off location. 
      These 12 photos prove the vehicle was left in the same condition
       as when you picked it up. The pictures upload instantly to the app, 
       so they don’t get saved on your phone.Location only turns on when you hit Start on a route, 
       and turns off when you hit End.This app requires a smartphone with a camera and GPS — works 
       on any iPhone or Android
    </p>
    <p className="text-sm mt-2 text-slate-500 dark:text-slate-400">
      Requires a smartphone with camera & GPS — works on any iPhone or Android.
    </p>
  </div>

  {/* Permission steps */}
  <div>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
      How to enable camera & location permissions
    </h3>

    {/* iPhone steps */}
    <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-4">
      <p className="font-medium text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        📱 iPhone
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="text-blue-600 dark:text-blue-400 font-mono mr-1">1.</span>
          <span>
            <span className="font-medium">Safari:</span> Settings {'>'} Privacy & Security {'>'} Location Services {'>'} Safari → <em>While Using the App</em>.<br />
            Also: Settings {'>'} Safari {'>'} Camera → Allow.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600 dark:text-blue-400 font-mono mr-1">2.</span>
          <span>
            <span className="font-medium">Chrome:</span> Settings {'>'} Chrome {'>'} Location and Camera → <em>While Using the App</em>.
          </span>
        </li>
      </ul>
    </div>

    {/* Android steps */}
    <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <p className="font-medium text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        🤖 Android
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="text-green-600 dark:text-green-400 font-mono mr-1">1.</span>
          <span>
            <span className="font-medium">Chrome</span> (most common): Settings {'>'} Apps {'>'} Chrome {'>'} Permissions → turn on <strong>Camera</strong> and <strong>Location</strong>.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-green-600 dark:text-green-400 font-mono mr-1">2.</span>
          <span>
            For <span className="font-medium">Samsung Internet</span> or <span className="font-medium">Firefox</span>, do the same in their app settings.
          </span>
        </li>
      </ul>
    </div>

    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
      After changing settings, come back here and tap <strong>“Allow”</strong> on both pop‑ups. If it still doesn’t work, refresh the page or reopen your browser.
    </p>
  </div>

  {/* Call to action */}
  <p className="text-sm text-slate-600 dark:text-slate-300 italic">
    When you tap the button below, we’ll ask you to allow camera and location. 
    Just tap Allow — it’s only used while you’re on an active route.
  </p>
</div>

          {/* Permission status / retry message */}
          {(camCheck || locCheck || awaitingLocation) && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 space-y-2 text-left">
              {camCheck && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-amber-800 dark:text-amber-200">
                    {camCheck.granted ? "✓" : "✗"}
                  </span>
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold">
                    Camera {camCheck.granted ? "allowed" : "blocked"}
                    {!camCheck.granted && camCheck.detail ? ` — ${camCheck.detail}` : ""}
                  </p>
                </div>
              )}
              {locCheck && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-amber-800 dark:text-amber-200">
                    {locCheck.granted ? "✓" : "✗"}
                  </span>
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold">
                    Location {locCheck.granted ? "allowed" : "blocked"}
                    {!locCheck.granted && locCheck.detail ? ` — ${locCheck.detail}` : ""}
                  </p>
                </div>
              )}
              {awaitingLocation && !locCheck && (
                <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold">
                  ✓ Camera done. One more step: tap the button below — the
                  location popup will appear now.
                </p>
              )}
              {permissionError && (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {permissionError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className=" sticky bottom-0 w-full bg-background-light dark:from-background-dark dark:via-background-dark pt-8 pb-6 px-6 safe-bottom">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleContinue}
            disabled={isRequesting}
            className="w-full py-4 rounded-2xl lime-btn hover:shadow-xl hover:shadow-primary/20 transition flex items-center justify-center gap-2 h-14 text-base font-black"
          >
            {isRequesting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Requesting permissions…
              </>
            ) : awaitingLocation ? (
              "Tap to allow location"
            ) : permissionError ? (
              "Retry Permissions"
            ) : (
              "Cool, let's go!"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
