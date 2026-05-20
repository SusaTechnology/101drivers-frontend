import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROOF_CAM_FLAG = "hasSeenProofCam";

export default function DriverProofCamPage() {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
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

  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Request camera permission
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Stop the stream immediately — we just needed permission
      cameraStream.getTracks().forEach((track) => track.stop());

      // Request geolocation permission
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000,
        });
      });

      return true;
    } catch (err: any) {
      console.warn("Permission request failed:", err);
      return false;
    }
  };

  const handleContinue = async () => {
    setPermissionError(null);
    setIsRequesting(true);

    const granted = await requestPermissions();
    console.log(granted)
    if (granted) {
      try {
        localStorage.setItem(PROOF_CAM_FLAG, "true");
      } catch {
        // Storage may not be available
      }
      navigate({ to: "/driver/dashboard" });
    } else {
      setPermissionError(
        "Camera and location access are required for deliveries. Please tap Allow on both prompts to continue."
      );
    }

    setIsRequesting(false);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col overflow-hidden">
      {/* Back link top-left */}
      <div className="sticky top-0 p-6">
        <Link
          to="/landing"
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

          {/* Permission error / retry message */}
          {permissionError && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold">
                {permissionError}
              </p>
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
