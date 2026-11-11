import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// LivePhotoCapture — the ONLY way a photo enters the driver onboarding
// form. Instead of a hidden <input type="file" capture>, which desktop
// browsers silently downgrade to a full file picker (the gallery/disk
// loophole on touchscreen laptops), this component grabs the frame from a
// LIVE getUserMedia() stream. No file picker exists on the page at all, so
// a picked-from-gallery or downloaded image can never be submitted — on
// any device class. Requires HTTPS (the production site is HTTPS-only);
// the camera must be opened from a user gesture (iOS Safari requirement),
// which the tap-to-open flow satisfies.
//
// Ownership: the PARENT owns the captured preview (it already renders the
// preview tile and clears it when an upload fails). This component renders
// the trigger (tile / square / button variants), the full-screen live
// camera overlay, and calls onCapture(file, previewDataUrl). Tapping a
// shown preview calls onRetake so the parent clears it and the trigger
// reappears.

interface LivePhotoCaptureProps {
  /** File-name part, e.g. "selfie" → live-selfie-1730000000.jpg */
  kind: string;
  /** Which camera to prefer: "user" = front (selfie), "environment" = rear (license). */
  facing: "user" | "environment";
  /** Guidance shown while framing, e.g. "Fit the FRONT of your license inside the frame". */
  hint: string;
  /** tile = full-width h-32 box (license), square = w-20 h-20 button (selfie),
   *  button = outline button with label. */
  variant?: "tile" | "square" | "button";
  /** Parent-owned preview of the captured photo; when set the trigger shows it. */
  previewUrl?: string | null;
  /** An upload for this photo is in flight → spinner, triggers disabled. */
  uploading?: boolean;
  /** Hard-disable (form is submitting). */
  disabled?: boolean;
  /** Label for the button variant / tile text. */
  buttonLabel?: string;
  onCapture: (file: File, previewDataUrl: string) => void;
  /** The user tapped a shown preview to retake it. */
  onRetake?: () => void;
  className?: string;
}

type OverlayState = "closed" | "starting" | "live" | "error";

/** Longest edge of the captured JPEG — plenty for license text at ~300KB. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export function LivePhotoCapture({
  kind,
  facing,
  hint,
  variant = "tile",
  previewUrl = null,
  uploading = false,
  disabled = false,
  buttonLabel,
  onCapture,
  onRetake,
  className,
}: LivePhotoCaptureProps) {
  const [overlay, setOverlay] = useState<OverlayState>("closed");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // The DOMException name behind the error (NotAllowedError, NotReadableError,
  // …) — shown as a small technical line so support can tell the failure
  // modes apart ("driver allowed it but still blocked" reports).
  const [errName, setErrName] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Never leak a live camera when the component unmounts mid-session.
  useEffect(() => () => stopStream(), [stopStream]);

  const openCamera = useCallback(async () => {
    if (disabled || uploading) return;
    setErrName(null);
    if (!window.isSecureContext) {
      setErrorMsg(
        "The camera needs a secure connection. Please open this page using https and try again."
      );
      setOverlay("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(
        "This browser cannot open the camera. Please take this photo on your phone."
      );
      setOverlay("error");
      return;
    }
    setOverlay("starting");
    setErrorMsg(null);
    // The camera is BUSY for a beat after a previous stream stops (or while
    // another app holds it) — browsers report NotReadableError. One silent
    // retry after a short wait clears the common race; only a persistent
    // busy surfaces as an error.
    const acquire = async (): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if ((err as DOMException)?.name !== "NotReadableError") throw err;
        await new Promise((resolve) => setTimeout(resolve, 900));
        return await navigator.mediaDevices.getUserMedia(constraints);
      }
    };
    try {
      const stream = await acquire();
      streamRef.current = stream;
      // The <video> element attaches and starts in the effect below (runs
      // after the overlay DOM is committed — see the iOS notes there).
      setOverlay("live");
    } catch (err) {
      const name = (err as DOMException)?.name || "UnknownError";
      setErrName(name);
      if (name === "NotAllowedError" || name === "SecurityError") {
        setErrorMsg(
          "Your browser did not give this page camera access. Try these, in order: " +
            "(1) if you opened this link from Instagram, Facebook, WhatsApp or Gmail, " +
            "open it in Safari (iPhone) or Chrome (Android) instead — in-app browsers " +
            "block the camera even when allowed; (2) allow camera for this site in the " +
            "browser settings (iPhone: Settings → Safari → Camera → Allow); " +
            "(3) if you added this app to your home screen, delete and re-add it, or " +
            "open the site in Safari. Then tap Try again."
        );
      } else if (name === "NotReadableError") {
        setErrorMsg(
          "The camera is busy in another app. Close any other app using the camera, then tap Try again."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setErrorMsg(
          "No usable camera was found on this device. Please take this photo on your phone."
        );
      } else {
        setErrorMsg(
          "The camera could not be opened. Please try again, or take this photo on your phone."
        );
      }
      setOverlay("error");
    }
  }, [disabled, uploading, facing]);

  // Attach the stream and start playback from an EFFECT, not a rAF callback:
  // the effect runs after React has committed the overlay's <video>, and the
  // retry ladder covers iOS Safari's silent black-screen modes — play() fired
  // before the element has metadata/layout (rejected with nobody noticing,
  // because the old code swallowed the rejection), and AbortError when
  // metadata lands mid-play. muted is also set as a PROPERTY here: React's
  // muted attribute does not reliably reach the DOM property before autoplay
  // on Safari, which is another way the preview stays black.
  useEffect(() => {
    if (overlay !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.muted = true;
    video.srcObject = stream;
    let cancelled = false;
    const start = () => {
      if (cancelled || !video.paused) return;
      video.play().catch(() => {
        if (cancelled) return;
        // First play() raced the decode pipeline — retry once the first
        // frame is decodable (loadeddata).
        video.addEventListener(
          "loadeddata",
          () => {
            if (!cancelled) video.play().catch(() => {});
          },
          { once: true }
        );
      });
    };
    if (video.readyState >= 1) start();
    else video.addEventListener("loadedmetadata", start, { once: true });
    return () => {
      cancelled = true;
    };
  }, [overlay]);

  const closeCamera = useCallback(() => {
    stopStream();
    setOverlay("closed");
  }, [stopStream]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Captured frame is stored un-mirrored (what the camera sees); only the
    // live PREVIEW is mirrored for the front camera, like every native app.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        setOverlay("closed");
        const file = new File([blob], `live-${kind}-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file, dataUrl);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  }, [kind, onCapture, stopStream]);

  const triggerDisabled = disabled || uploading;

  // ── Preview state (parent owns the image) ──
  if (previewUrl) {
    if (variant === "square") {
      return (
        <button
          type="button"
          onClick={triggerDisabled ? undefined : onRetake}
          className={cn(
            "w-20 h-20 rounded-2xl overflow-hidden border-2 shrink-0 transition-all",
            triggerDisabled ? "cursor-default" : "cursor-pointer hover:opacity-80",
            "border-green-400"
          )}
          aria-label="Tap to retake photo"
        >
          <img src={previewUrl} alt="Captured" className="w-full h-full object-cover" />
        </button>
      );
    }
    return (
      <div className={cn("space-y-1", className)}>
        <img
          src={previewUrl}
          alt="Captured"
          className={cn(
            "w-full h-32 object-cover rounded-xl border-2 border-green-400",
            !triggerDisabled && "cursor-pointer hover:opacity-80 transition-opacity"
          )}
          onClick={triggerDisabled ? undefined : onRetake}
        />
        <p className="text-[10px] text-slate-400">
          {uploading ? "Uploading..." : "Tap the photo to retake"}
        </p>
      </div>
    );
  }

  // ── Trigger state ──
  const tileContent = (
    <>
      {uploading ? (
        <div className="animate-spin w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full" />
      ) : (
        <Camera className="w-6 h-6 text-slate-400" />
      )}
      <span className="text-xs text-slate-500">
        {uploading ? "Uploading..." : buttonLabel || "Tap to take photo"}
      </span>
      <span className="text-[10px] text-slate-400 leading-snug">
        Live camera only — gallery photos are not accepted
      </span>
    </>
  );

  if (variant === "square") {
    return (
      <>
        <button
          type="button"
          onClick={openCamera}
          disabled={triggerDisabled}
          aria-label="Take photo with camera"
          className={cn(
            "w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 shrink-0 transition-all",
            "hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/10",
            triggerDisabled && "opacity-60 cursor-not-allowed",
            className
          )}
        >
          {uploading ? (
            <div className="animate-spin w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full" />
          ) : (
            <Camera className="w-7 h-7 text-slate-400" />
          )}
        </button>
        <CameraOverlay
          overlay={overlay}
          errorMsg={errorMsg}
          errName={errName}
          hint={hint}
          mirrored={facing === "user"}
          videoRef={videoRef}
          onClose={closeCamera}
          onCapture={captureFrame}
          onRetry={openCamera}
        />
      </>
    );
  }

  if (variant === "button") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={openCamera}
          disabled={triggerDisabled}
          className={cn("w-full h-10 rounded-xl", className)}
        >
          <Camera className="w-4 h-4 mr-2" />
          {buttonLabel || "Take photo"}
        </Button>
        <CameraOverlay
          overlay={overlay}
          errorMsg={errorMsg}
          errName={errName}
          hint={hint}
          mirrored={facing === "user"}
          videoRef={videoRef}
          onClose={closeCamera}
          onCapture={captureFrame}
          onRetry={openCamera}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openCamera}
        disabled={triggerDisabled}
        className={cn(
          "w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1.5 text-center px-3 transition-colors",
          "hover:border-lime-500 dark:hover:border-lime-500",
          triggerDisabled && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        {tileContent}
      </button>
      <CameraOverlay
        overlay={overlay}
        errorMsg={errorMsg}
        errName={errName}
        hint={hint}
        mirrored={facing === "user"}
        videoRef={videoRef}
        onClose={closeCamera}
        onCapture={captureFrame}
        onRetry={openCamera}
      />
    </>
  );
}

// ── Full-screen live camera overlay ─────────────────────────────────

interface CameraOverlayProps {
  overlay: OverlayState;
  errorMsg: string | null;
  /** DOMException name behind errorMsg (for the technical detail line). */
  errName?: string | null;
  hint: string;
  mirrored: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onCapture: () => void;
  onRetry: () => void;
}

function CameraOverlay({
  overlay,
  errorMsg,
  errName,
  hint,
  mirrored,
  videoRef,
  onClose,
  onCapture,
  onRetry,
}: CameraOverlayProps) {
  if (overlay === "closed") return null;

  return (
    // The page draws UNDER the iPhone status bar (viewport-fit=cover), so the
    // whole overlay — the X in particular — must start below the safe-area
    // inset or the built-in header swallows the taps. Same convention as
    // routes/driver.tsx and the app bars.
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-bold">Live camera</span>
        <button type="button" onClick={onClose} aria-label="Close camera" className="p-2 -mr-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {overlay === "error" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400" />
          <p className="text-sm text-slate-200 max-w-sm">{errorMsg}</p>
          {errName && (
            <p className="text-[10px] text-slate-500">
              Technical detail: {errName}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl text-white">
              Close
            </Button>
          </div>
        </div>
      ) : overlay === "starting" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin w-10 h-10 border-2 border-white border-t-transparent rounded-full" />
          <p className="text-sm text-slate-300">Opening camera…</p>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center px-4 min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "max-h-full max-w-full rounded-2xl object-contain bg-black",
                mirrored && "scale-x-[-1]"
              )}
            />
          </div>
          <p className="text-center text-xs text-slate-300 px-6 pb-2">{hint}</p>
          {/* Bottom inset: keep the shutter clear of the home indicator. */}
          <div
            className="flex items-center justify-center pt-2"
            style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              type="button"
              onClick={onCapture}
              aria-label="Capture photo"
              className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 active:scale-95 transition-transform"
            />
          </div>
        </>
      )}
    </div>
  );
}
