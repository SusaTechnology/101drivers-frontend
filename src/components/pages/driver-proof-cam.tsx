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
        navigate({ to: "/driver-dashboard" });
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
          timeout: 10000,
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

    if (granted) {
      try {
        localStorage.setItem(PROOF_CAM_FLAG, "true");
      } catch {
        // Storage may not be available
      }
      navigate({ to: "/driver-dashboard" });
    } else {
      setPermissionError(
        "Camera and location access are required for deliveries. Please tap Allow on both prompts to continue."
      );
    }

    setIsRequesting(false);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex flex-col">
      {/* Back link top-left */}
      <div className="p-6">
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

          <div className="space-y-4 text-lg text-slate-600 dark:text-slate-300 leading-relaxed text-left">
            <p>
              Your phone is your proof camera. That just means you use it to
              take six pictures of the vehicle before and after each job. Those
              photos get uploaded to the app so the customer has proof everything
              was done right. You don&rsquo;t need to keep the pictures.
            </p>
            <p>
              Location turns on only when you hit Start on a route, and it turns
              off when you hit End.
            </p>
            <p>
              This app requires a smartphone with a camera and GPS — works on
              any iPhone or Android.
            </p>
            <p>
              When you tap the button below, we&rsquo;ll ask you to allow
              camera and location. Just tap Allow — it&rsquo;s only used while
              you&rsquo;re on an active route.
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
      <div className="sticky bottom-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-background-dark dark:via-background-dark pt-8 pb-6 px-6 safe-bottom">
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
