// DriverSignInMethods — "Sign-in methods" account-security screen (drivers).
// Uses ONLY official Better Auth client APIs: listAccounts / linkSocial /
// unlinkAccount / changePassword. Server-side protections are Better Auth's
// own: linking requires an authenticated session; auto-linking requires a
// provider-VERIFIED email; unlinking the last usable credential is refused
// unless allowUnlinkingAll is set (it is not).

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, KeyRound, Link2, Loader2, Lock, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/betterAuth/auth-client";

interface BaAccount {
  id: string;
  providerId: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: "Email & password",
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
  yahoo: "Yahoo",
};

const SOCIAL_PROVIDERS = ["google", "microsoft", "apple", "yahoo"] as const;

export function DriverSignInMethods() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<BaAccount[] | null>(null);
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  // Change-password form (credential accounts only)
  const [hasCredential, setHasCredential] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const providersRes = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/ba/providers`
    );
    const providers: Record<string, boolean> = providersRes.ok
      ? await providersRes.json()
      : {};
    const { data: accountList, error } = await authClient.listAccounts({
      query: {},
      fetchOptions: { throw: false },
    });
    setEnabledProviders(providers);
    setAccounts(accountList ?? []);
    setHasCredential(!!accountList?.some((a) => a.providerId === "credential"));
    if (error) toast.error("Could not load your sign-in methods");
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const linkProvider = async (provider: string) => {
    setBusyProvider(provider);
    try {
      await authClient.linkSocial({
        provider: provider as "google" | "microsoft" | "apple" | "yahoo",
        callbackURL: "/auth/social-callback",
      });
      // Browser redirected to the provider — nothing to clean up.
    } catch {
      setBusyProvider(null);
      toast.error(`Could not start linking ${PROVIDER_LABELS[provider] ?? provider}`);
    }
  };

  const unlinkAccount = async (account: BaAccount) => {
    const label = PROVIDER_LABELS[account.providerId] ?? account.providerId;
    setBusyProvider(account.providerId);
    const { error } = await authClient.unlinkAccount({ accountId: account.id });
    setBusyProvider(null);
    if (error) {
      // Better Auth refuses removing the last usable credential — surface it.
      toast.error(error.message || `Could not unlink ${label}`);
      return;
    }
    toast.success(`${label} unlinked`);
    void reload();
  };

  const changePassword = async () => {
    setPasswordMsg(null);
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ kind: "err", text: "Fill in both password fields." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ kind: "err", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ kind: "err", text: "New passwords do not match." });
      return;
    }
    setBusyProvider("password");
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setBusyProvider(null);
    if (error) {
      setPasswordMsg({
        kind: "err",
        text: error.message || "Could not change the password. Check your current password.",
      });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg({ kind: "ok", text: "Password changed. Other sessions were signed out." });
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      <div
        className="sticky top-0 z-40 bg-white/85 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-xl mx-auto px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/driver/menu" })}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Back"
          >
            <KeyRound className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black">Sign-in methods</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-5">
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          All the ways you can sign in to 101 Drivers. Everything signs into the
          same account — adding a method never creates a second one.
        </p>

        {accounts === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900/40">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-bold">
                      {PROVIDER_LABELS[a.providerId] ?? a.providerId}
                    </span>
                  </div>
                  {a.providerId !== "credential" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyProvider !== null}
                      onClick={() => unlinkAccount(a)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      {busyProvider === a.providerId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      Unlink
                    </Button>
                  )}
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No sign-in methods found.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Add a sign-in method
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {SOCIAL_PROVIDERS.filter((p) => enabledProviders?.[p]).map((p) => {
                  const linked = accounts?.some((a) => a.providerId === p);
                  if (linked) return null;
                  return (
                    <Button
                      key={p}
                      variant="outline"
                      disabled={busyProvider !== null}
                      onClick={() => linkProvider(p)}
                      className="rounded-xl"
                    >
                      {busyProvider === p ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4 mr-2" />
                      )}
                      {PROVIDER_LABELS[p]}
                    </Button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Linking requires signing in to the provider. A provider is only
                linked to your account when its email is verified and matches
                yours — otherwise you&apos;ll be asked first. You can&apos;t
                remove your last usable sign-in method.
              </p>
            </div>

            {hasCredential && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-black">Change password</h2>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="curPw">Current password</Label>
                    <Input
                      id="curPw"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newPw">New password</Label>
                    <Input
                      id="newPw"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confPw">Confirm new password</Label>
                    <Input
                      id="confPw"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {passwordMsg && (
                  <div
                    className={`flex items-start gap-2 text-sm p-3 rounded-xl ${
                      passwordMsg.kind === "ok"
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {passwordMsg.text}
                  </div>
                )}
                <Button
                  onClick={changePassword}
                  disabled={busyProvider === "password"}
                  className="w-full rounded-xl"
                >
                  {busyProvider === "password" && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Update password
                </Button>
              </div>
            )}

            <p className="text-[11px] text-slate-400 leading-snug">
              Password resets and email verification arrive from
              noreply@101drivers.com. 101 Drivers will never ask for your
              password over chat or email.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
