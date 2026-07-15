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
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { getAccessToken } from "@/lib/tanstack/dataQuery";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL;

interface InsurancePortalPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for viewing and changing the insurance portal password.
 *
 * Fetches the current password from GET /api/insurance-portal/password
 * and updates it via POST /api/insurance-portal/password.
 *
 * Both endpoints require admin JWT auth.
 */
export function InsurancePortalPasswordDialog({
  open,
  onOpenChange,
}: InsurancePortalPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [isSet, setIsSet] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current password when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    setPassword("");
    setIsSet(false);

    const token = getAccessToken();
    fetch(`${API_BASE}/api/insurance-portal/password`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPassword(data.password ?? "");
        setIsSet(data.isSet ?? false);
      })
      .catch(() => {
        /* swallow — empty state will show */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = () => {
    if (!password || password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setIsSaving(true);
    const token = getAccessToken();
    fetch(`${API_BASE}/api/insurance-portal/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ password }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        toast.success("Insurance portal password updated");
        setIsSet(true);
        onOpenChange(false);
      })
      .catch(() => toast.error("Failed to update password"))
      .finally(() => setIsSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Insurance Portal Password
          </DialogTitle>
          <DialogDescription>
            Set the password used to access the insurance reporting portal at{" "}
            <code className="font-bold text-primary">/insurance-portal</code>.
            Share it with authorized insurance partners.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Status:
              </span>
              {isSet ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Password is set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertCircle className="w-3 h-3" /> No password set
                </span>
              )}
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Portal Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 4 characters)..."
                  className="h-10 text-sm rounded-xl pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                The insurance portal is a standalone page that insurance
                partners use to view delivery reports. It requires this
                password — no user account or login needed.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="lime-btn rounded-xl"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Save Password
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
