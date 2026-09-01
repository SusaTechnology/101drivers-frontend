/**
 * TestReferralLookupPage — public referral code search by name.
 *
 * Route: /test-referral (no code param)
 *
 * Anyone can type a name and get matching referral codes back. Clicking
 * a result navigates to /test-referral/CODE (the landing page with
 * signup CTAs + QR code).
 *
 * The search is debounced (400ms) and calls the public endpoint:
 *   GET /api/referrals/public/lookup?name=...
 *
 * Results show:
 *   - Referrer name (privacy-masked: "John S." for personal, business name in full)
 *   - Referrer type (Driver / Customer)
 *   - Referral code (monospace, clickable → navigates to /test-referral/CODE)
 *
 * No auth required — this is a public page.
 */
import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Gift, Search, ArrowRight, User, Car, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/shared/SEOHead";
import { useDataQuery } from "@/lib/tanstack/dataQuery";
import { useDebouncedValue } from "@/hooks/useDebounce";

const API_URL = import.meta.env.VITE_API_URL;

type LookupResult = {
  code: string;
  referrerName: string;
  referrerType: "DRIVER" | "CUSTOMER";
};

type LookupResponse = {
  results: LookupResult[];
};

export default function TestReferralLookupPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 400);

  const lookupQuery = useDataQuery<LookupResponse | null>({
    apiEndPoint: `${API_URL}/api/referrals/public/lookup?name=${encodeURIComponent(debouncedQuery)}`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
    enabled: debouncedQuery.length >= 2,
    queryKey: ["referral-lookup", debouncedQuery],
    staleTime: 30_000,
  });

  const results = lookupQuery.data?.results ?? [];
  const isLoading = lookupQuery.isFetching && debouncedQuery.length >= 2;

  const handleResultClick = (code: string) => {
    navigate({ to: `/test-referral/${code}` });
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white flex items-center justify-center px-4 py-8">
      <SEOHead
        title="Find a Referral Code — 101 Drivers"
        description="Search for a 101drivers referral code by name. Enter a friend's name to find their code and sign up with it."
      />

      <div className="w-full max-w-md">
        {/* ── Header ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight">101 Drivers</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Referral Program · Find a Code
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-black text-center">
              Find a Referral Code
            </CardTitle>
            <CardDescription className="text-center text-sm text-slate-600 dark:text-slate-400 mt-1">
              Search by name to find a friend's referral code. Click a result
              to see their referral page with signup links.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ── Search input ── */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a name (e.g. John, Acme Auto)..."
                className="h-12 pl-10 rounded-2xl"
                autoFocus
              />
            </div>

            {/* ── Minimum length hint ── */}
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="text-xs text-slate-400 text-center">
                Type at least 2 characters to search.
              </p>
            )}

            {/* ── Loading ── */}
            {isLoading && (
              <div className="py-8 text-center">
                <Spinner className="size-6 mx-auto text-slate-400" />
                <p className="text-sm text-slate-400 mt-2">Searching…</p>
              </div>
            )}

            {/* ── Results ── */}
            {!isLoading && debouncedQuery.length >= 2 && (
              <>
                {results.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm text-slate-500">
                      No referrers found for "{debouncedQuery}".
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try a different name or ask your friend for their code directly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      {results.length} {results.length === 1 ? "result" : "results"}
                    </p>
                    {results.map((r) => (
                      <button
                        key={r.code}
                        onClick={() => handleResultClick(r.code)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition text-left"
                      >
                        {/* Icon based on referrer type */}
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                          {r.referrerType === "DRIVER" ? (
                            <Car className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Building className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>

                        {/* Name + type */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {r.referrerName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={
                              r.referrerType === "CUSTOMER"
                                ? "text-[9px] chip-emerald"
                                : "text-[9px] chip-gray"
                            }>
                              {r.referrerType === "DRIVER" ? "Driver" : "Customer"}
                            </Badge>
                            <span className="text-xs font-mono text-slate-500 tracking-wider">
                              {r.code}
                            </span>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Empty state (no search yet) ── */}
            {!isLoading && debouncedQuery.length < 2 && (
              <div className="py-6 text-center">
                <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">
                  Start typing a name to find referral codes.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Search works for both drivers and customers (dealers + private).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Footer ── */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            101 Drivers · Referral Program ·{" "}
            <Link to="/about" className="underline hover:text-slate-600 dark:hover:text-slate-300">
              Learn more
            </Link>
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Already have a code?{" "}
            <Link to="/" className="underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
              Go to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
