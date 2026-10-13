// src/components/pages/admin-service-area.tsx
//
// Admin — Service Area (the "green pickup area").
//
// Ops manages exactly ONE polygon here: the LA metro service zone. The
// ring lives in the DATABASE (ServiceAreaPolygon, ordered [lat, lng]
// pairs) so saving a new shape never needs a deploy. The page supports:
//   • draggable polygon vertices (native Google Maps editing handles)
//   • a flip-count PREVIEW before saving ("how many drivers would flip?")
//   • save (PUT) → the backend validates the shape (self-intersections
//     rejected), saves, re-runs point-in-polygon for ALL drivers, flips
//     their derived badges, and audits every change
//
// The badge is DERIVED and INFORMATIONAL: green = ZIP inside the polygon
// = eligible for first-level review / call follow-up. It never activates,
// never deactivates, never rejects anyone — Driver.status stays 100%
// manual, and the California-only signup gate is unchanged.

// @ts-nocheck
import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GoogleMap, Polygon, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'sonner';
import {
  MapPinned,
  ArrowLeft,
  Loader2,
  Edit3,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Users,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from '@/lib/google-maps-config';
import { useDataQuery, useDataMutation } from '@/lib/tanstack/dataQuery';
import { useQueryClient } from '@tanstack/react-query';

const BASE_URL = `${import.meta.env.VITE_API_URL}/api/admin/service-area`;

const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '520px',
};

// Center over the LA metro zone.
const DEFAULT_CENTER = { lat: 33.9, lng: -118.2 };
const DEFAULT_ZOOM = 7;

// ── API contract (backend/src/geo/service-area.controller.ts) ──
interface PolygonDto {
  name: string;
  coords: [number, number][]; // [lat, lng] pairs, ordered ring, auto-closed
  updatedAt?: string;
}

interface StatsDto {
  totalDrivers: number;
  inArea: number;
  outOfArea: number;
  unresolved: number;
  flagged: number;
}

interface SummaryDto {
  totalDrivers: number;
  inArea: number;
  outOfArea: number;
  unresolved: number;
  flippedToIn: number;
  flippedToOut: number;
  flippedZipsIn: string[];
  flippedZipsOut: string[];
}

/** DB ring → Google Maps path. */
function coordsToPaths(coords: [number, number][] | undefined | null) {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]))
    .map(([lat, lng]) => ({ lat, lng }));
}

/** Google Maps path (MVCArray or array) → DB ring (first vertex NOT repeated). */
function pathsToCoords(paths) {
  const arr = 'getArray' in paths ? paths.getArray() : paths;
  return arr.map((p) => [
    typeof p.lat === 'function' ? p.lat() : p.lat,
    typeof p.lng === 'function' ? p.lng() : p.lng,
  ]);
}

export default function AdminServiceAreaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Google Maps ──
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // ── Data ──
  const zoneQuery = useDataQuery<{ polygon: PolygonDto; stats: StatsDto }>({
    apiEndPoint: BASE_URL,
    noFilter: true,
    staleTime: 30 * 1000,
  });
  const polygon = zoneQuery.data?.polygon ?? null;
  const stats = zoneQuery.data?.stats;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['data', BASE_URL] });
    // Badge columns live on the admin users rows too — refresh those.
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-users-v2'] });
    queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
  };

  const previewMutation = useDataMutation<{ summary: SummaryDto }, { coords: [number, number][] }>({
    apiEndPoint: `${BASE_URL}/preview`,
    method: 'POST',
    getBody: (variables) => JSON.stringify(variables),
  });

  const saveMutation = useDataMutation<{ polygon: PolygonDto; summary: SummaryDto }, { name?: string; coords: [number, number][] }>({
    apiEndPoint: BASE_URL,
    method: 'PUT',
    getBody: (variables) => JSON.stringify(variables),
    onSuccess: (data) => {
      toast.success('Service area saved', {
        description: `${data?.summary?.flippedToIn ?? 0} driver badge(s) turned green, ${data?.summary?.flippedToOut ?? 0} turned gray. Every flip is audited.`,
      });
      setShowConfirm(false);
      setEditMode(false);
      invalidateAll();
      zoneQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to save service area', { description: error.message });
    },
  });

  // ── Editing state ──
  const [editMode, setEditMode] = useState(false);
  const [editedCoords, setEditedCoords] = useState<[number, number][]>([]);
  const [vertexCount, setVertexCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const polygonRef = useRef(null);

  const syncFromPolygon = useCallback(() => {
    if (!polygonRef.current) return;
    const ring = pathsToCoords(polygonRef.current.getPath());
    setEditedCoords(ring);
    setVertexCount(ring.length);
  }, []);

  const handlePolygonLoad = useCallback(
    (poly) => {
      polygonRef.current = poly;
      const path = poly.getPath();
      const update = () => syncFromPolygon();
      google.maps.event.clearListeners(path, 'insert_at');
      google.maps.event.clearListeners(path, 'remove_at');
      google.maps.event.clearListeners(path, 'set_at');
      path.addListener('insert_at', update);
      path.addListener('remove_at', update);
      path.addListener('set_at', update);
      syncFromPolygon();
    },
    [syncFromPolygon],
  );

  const startEdit = () => {
    setEditedCoords((polygon?.coords ?? []).map(([lat, lng]) => [lat, lng]));
    setVertexCount((polygon?.coords ?? []).length);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditedCoords([]);
    setVertexCount(0);
    polygonRef.current = null;
  };

  // ── Preview → confirm → save ──
  const handlePreview = () => {
    if (editedCoords.length < 3) {
      toast.error('A polygon needs at least 3 vertices');
      return;
    }
    previewMutation.mutate(
      { coords: editedCoords },
      {
        onSuccess: (data) => {
          setShowConfirm(true);
        },
        onError: (error: Error) => {
          // The backend validates the shape (self-intersections, bad
          // vertices) and returns a 400 with the reason.
          toast.error('Invalid polygon', { description: error.message });
        },
      },
    );
  };

  const confirmSave = () => {
    saveMutation.mutate({ coords: editedCoords });
  };

  // ── Render helpers ──
  const displayCoords = editMode ? editedCoords : polygon?.coords ?? [];
  const displayPaths = coordsToPaths(displayCoords);
  const center =
    displayPaths.length > 0
      ? displayPaths.reduce(
          (acc, p) => ({ lat: acc.lat + p.lat / displayPaths.length, lng: acc.lng + p.lng / displayPaths.length }),
          { lat: 0, lng: 0 },
        )
      : DEFAULT_CENTER;

  const summary = previewMutation.data?.summary;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate({ to: '/admin-config' })}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPinned className="w-5 h-5 text-emerald-500" />
              Service Area
              {polygon?.name && (
                <Badge variant="outline" className="text-[10px] font-bold">
                  {polygon.name}
                </Badge>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The green pickup area — a driver&apos;s ZIP inside this polygon is eligible for first-level review. Badges are informational; status stays manual.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-2xl border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.inArea ?? '—'}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In pickup area</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.outOfArea ?? '—'}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Out of area</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-amber-100 dark:border-amber-900/40 bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.flagged ?? '—'}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Flagged for review</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{stats?.totalDrivers ?? '—'}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total drivers</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map card */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black">Polygon editor</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {editMode
                    ? 'Drag the vertices (or an edge) to reshape the zone. Saving re-checks every driver automatically.'
                    : 'Toggle Edit to reshape the zone by dragging its vertices.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <Button className="rounded-2xl lime-btn font-extrabold" onClick={startEdit} disabled={!polygon || zoneQuery.isLoading}>
                    <Edit3 className="w-4 h-4 mr-1" /> Edit zone
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="rounded-2xl font-extrabold" onClick={cancelEdit} disabled={saveMutation.isPending}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button className="rounded-2xl lime-btn font-extrabold" onClick={handlePreview} disabled={previewMutation.isPending || saveMutation.isPending}>
                      {previewMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Preview &amp; save
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadError ? (
              <div className="h-[520px] flex items-center justify-center text-sm text-rose-500">
                Failed to load Google Maps — check VITE_GOOGLE_MAPS_API_KEY.
              </div>
            ) : !isLoaded ? (
              <div className="h-[520px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="relative">
                <GoogleMap
                  mapContainerStyle={CONTAINER_STYLE}
                  center={center}
                  zoom={editMode ? 8 : DEFAULT_ZOOM}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    draggableCursor: 'default',
                  }}
                >
                  <Polygon
                    path={displayPaths}
                    onLoad={editMode ? handlePolygonLoad : undefined}
                    options={{
                      fillColor: '#84cc16',
                      fillOpacity: editMode ? 0.25 : 0.18,
                      strokeColor: '#65a30d',
                      strokeOpacity: 1,
                      strokeWeight: 2,
                      editable: editMode,
                      draggable: editMode,
                      clickable: false,
                    }}
                  />
                </GoogleMap>
                {editMode && (
                  <div className="absolute left-3 bottom-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 shadow">
                    {vertexCount} vertex{vertexCount === 1 ? '' : 'es'} — drag any of them, or drag an edge to add one
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
                <p>
                  <strong className="text-slate-700 dark:text-slate-200">What green means:</strong> the driver&apos;s home ZIP sits
                  inside this polygon — the team reviews those first and follows up by phone. It does <strong>not</strong> mean
                  approved; status changes are always manual, and a deactivated driver stays deactivated even inside the zone.
                </p>
                <p>
                  Drivers outside the polygon (but in California) stay gray on the waitlist — they are not rejected. Drivers with
                  no usable ZIP stay flagged for review. Saving a new polygon re-checks every driver automatically, and every
                  badge flip is audit-logged with its triggering ZIP.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Confirm dialog — flip counts before saving */}
      <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) setShowConfirm(false); }}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Apply the new zone?
            </DialogTitle>
            <DialogDescription>
              Saving re-runs the ZIP check for every driver. Here is what changes:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">Turn green (in pickup area)</span>
              <span className="font-black text-emerald-700 dark:text-emerald-300">{summary?.flippedToIn ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">Turn gray (out of area)</span>
              <span className="font-black text-slate-600 dark:text-slate-300">{summary?.flippedToOut ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <span className="font-bold text-amber-700 dark:text-amber-300">Unresolved / flagged</span>
              <span className="font-black text-amber-700 dark:text-amber-300">{summary?.unresolved ?? 0}</span>
            </div>
            {(summary?.flippedZipsIn?.length ?? 0) + (summary?.flippedZipsOut?.length ?? 0) > 0 && (
              <p className="text-[11px] text-slate-400 pt-1">
                Sample flipping ZIPs: {[...(summary?.flippedZipsIn ?? []), ...(summary?.flippedZipsOut ?? [])].slice(0, 8).join(', ')}
                {(summary?.flippedZipsIn?.length ?? 0) + (summary?.flippedZipsOut?.length ?? 0) > 8 ? ' …' : ''}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              No driver is approved, rejected, or deactivated by this — badges are informational; the team reviews and decides.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl font-extrabold" onClick={() => setShowConfirm(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button className="rounded-2xl lime-btn font-extrabold" onClick={confirmSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" /> Save &amp; recheck all
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
