// @ts-nocheck
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, DrawingManager, Polygon } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit3, Check, X, Undo2 } from 'lucide-react';
import { geoJsonToPaths, polygonToGeoJson } from '@/hooks/useAdminServiceDistricts';

const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '500px',
};

const DEFAULT_CENTER = { lat: 33.98, lng: -118.45 };
const DEFAULT_ZOOM = 12;

interface District {
  id?: string;
  code: string;
  name: string;
  active: boolean;
  geoJson: any;
}

interface DistrictDrawingMapProps {
  districts: District[];
  onSave?: (district: { code: string; name: string; active: boolean; geoJson: any }) => void;
  onUpdate?: (id: string, data: { name?: string; active?: boolean; geoJson?: any }) => void;
  onDelete?: (id: string) => void;
  isSaving?: boolean;
}

interface DraftPolygon {
  paths: google.maps.LatLngLiteral[];
  code: string;
  name: string;
}

export default function DistrictDrawingMap({
  districts,
  onSave,
  onUpdate,
  onDelete,
  isSaving = false,
}: DistrictDrawingMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const editPolygonRef = useRef<google.maps.Polygon | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftPolygons, setDraftPolygons] = useState<DraftPolygon[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const totalVertices = draftPolygons.reduce((sum, dp) => sum + dp.paths.length, 0);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Toggle drawing mode
  const toggleDrawing = useCallback(() => {
    if (drawingMode) {
      setDrawingMode(false);
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(null);
      }
    } else {
      setDrawingMode(true);
      setEditingId(null);
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      }
    }
  }, [drawingMode]);

  const handleDrawingManagerLoad = useCallback((dm: google.maps.drawing.DrawingManager) => {
    drawingManagerRef.current = dm;
    dm.setDrawingMode(null);

    google.maps.event.addListener(dm, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      const coords: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }

      const newDraft: DraftPolygon = {
        paths: coords,
        code: `ZONE_${draftPolygons.length + 1}`,
        name: `Zone ${draftPolygons.length + 1}`,
      };
      setDraftPolygons((prev) => [...prev, newDraft]);

      // Remove the drawn overlay (we'll render our own)
      polygon.setMap(null);

      // Turn off drawing mode after completing one polygon
      setDrawingMode(false);
      dm.setDrawingMode(null);
    });
  }, [draftPolygons.length]);

  // Save draft polygon as a district
  const handleSaveDraft = useCallback(
    (index: number) => {
      const draft = draftPolygons[index];
      const geoJson = polygonToGeoJson(draft.paths as any);
      onSave?.({
        code: draft.code,
        name: draft.name,
        active: true,
        geoJson,
      });
      setDraftPolygons((prev) => prev.filter((_, i) => i !== index));
    },
    [draftPolygons, onSave],
  );

  const handleRemoveDraft = useCallback((index: number) => {
    setDraftPolygons((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateDraft = useCallback(
    (index: number, updates: Partial<DraftPolygon>) => {
      setDraftPolygons((prev) =>
        prev.map((dp, i) => (i === index ? { ...dp, ...updates } : dp)),
      );
    },
    [],
  );

  // Start editing existing district polygon
  const startEdit = useCallback((district: District) => {
    setEditingId(district.id || null);
    setEditingName(district.name);
    setDrawingMode(false);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
    editPolygonRef.current = null;
  }, []);

  // Save edited polygon — reads from the edit polygon ref
  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const poly = editPolygonRef.current;
    if (poly) {
      const path = poly.getPath();
      const coords: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }
      const geoJson = polygonToGeoJson(coords as any);
      onUpdate?.(editingId, { name: editingName, geoJson });
    } else {
      // Fallback: just update name
      onUpdate?.(editingId, { name: editingName });
    }
    setEditingId(null);
    setEditingName('');
    editPolygonRef.current = null;
  }, [editingId, editingName, onUpdate]);

  // Fit map to show all polygons
  const fitAllBounds = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    districts.forEach((d) => {
      const paths = geoJsonToPaths(d.geoJson);
      paths.forEach((p) => {
        bounds.extend(p);
        hasAny = true;
      });
    });

    draftPolygons.forEach((dp) => {
      dp.paths.forEach((p) => {
        bounds.extend(p);
        hasAny = true;
      });
    });

    if (hasAny) {
      const mapDiv = mapRef.current.getDiv();
      const padV = Math.round(mapDiv.clientHeight * 0.12);
      const padH = Math.round(mapDiv.clientWidth * 0.08);
      mapRef.current.fitBounds(bounds, { top: padV, right: padH, bottom: padV, left: padH });
    }
  }, [districts, draftPolygons]);

  // Auto-fit when districts load
  useEffect(() => {
    if (districts.length > 0 && !editingId && draftPolygons.length === 0) {
      const timer = setTimeout(fitAllBounds, 500);
      return () => clearTimeout(timer);
    }
  }, [districts, editingId, draftPolygons, fitAllBounds]);

  // Build paths for editing
  const editPaths = editingId
    ? geoJsonToPaths(districts.find((d) => d.id === editingId)?.geoJson)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <Button
          size="sm"
          variant={drawingMode ? 'default' : 'outline'}
          onClick={toggleDrawing}
          className="rounded-xl font-extrabold text-xs gap-1.5"
        >
          {drawingMode ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel Drawing
            </>
          ) : (
            <>
              <Edit3 className="h-3.5 w-3.5" />
              Draw New Zone
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={fitAllBounds}
          className="rounded-xl font-extrabold text-xs gap-1.5"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Fit All
        </Button>

        {drawingMode && (
          <Badge className="bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-black">
            Click points on the map to draw a polygon. Double-click to finish.
          </Badge>
        )}

        {draftPolygons.length > 0 && (
          <Badge variant="secondary" className="text-[10px] font-black">
            {draftPolygons.length} unsaved zone{draftPolygons.length > 1 ? 's' : ''}
          </Badge>
        )}

        {totalVertices > 0 && (
          <span className="text-[10px] text-slate-400 font-medium">
            {totalVertices} vertices total
          </span>
        )}
      </div>

      {/* Map + Side Panel */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Map */}
        <div className="flex-1">
          <GoogleMap
            mapContainerStyle={CONTAINER_STYLE}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            onLoad={handleMapLoad}
            options={{
              mapTypeId: 'roadmap',
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
            }}
          >
            <DrawingManager
              onLoad={handleDrawingManagerLoad}
              options={{
                drawingMode: drawingMode ? google.maps.drawing.OverlayType.POLYGON : null,
                drawingControl: false,
                polygonOptions: {
                  fillColor: '#3b82f6',
                  fillOpacity: 0.2,
                  strokeColor: '#3b82f6',
                  strokeWeight: 3,
                  editable: false,
                  draggable: false,
                },
              }}
            />

            {/* Existing districts */}
            {districts.map((district) => {
              const paths = geoJsonToPaths(district.geoJson);
              if (paths.length === 0) return null;

              const isEditing = editingId === district.id;
              const isHovered = hoveredDistrict === district.id;

              // If editing, show amber; otherwise green
              if (isEditing) return null; // handled by separate edit overlay below

              return (
                <React.Fragment key={district.id}>
                  {/* Glow border */}
                  <Polygon
                    paths={paths}
                    options={{
                      fillColor: '#a9ce42',
                      fillOpacity: 0,
                      strokeColor: '#a9ce42',
                      strokeOpacity: isHovered ? 0.5 : 0.3,
                      strokeWeight: 8,
                      clickable: !drawingMode,
                      zIndex: 1,
                    }}
                  />
                  {/* Main fill */}
                  <Polygon
                    paths={paths}
                    options={{
                      fillColor: '#a9ce42',
                      fillOpacity: isHovered ? 0.3 : 0.2,
                      strokeColor: '#a9ce42',
                      strokeOpacity: isHovered ? 1 : 0.9,
                      strokeWeight: 3,
                      clickable: !drawingMode,
                      zIndex: 2,
                    }}
                    onMouseover={() => !drawingMode && setHoveredDistrict(district.id || null)}
                    onMouseout={() => setHoveredDistrict(null)}
                  />
                </React.Fragment>
              );
            })}

            {/* Edit polygon overlay (when editing existing) */}
            {editingId && editPaths.length > 0 && (
              <Polygon
                onLoad={(poly) => {
                  editPolygonRef.current = poly;
                }}
                paths={editPaths}
                options={{
                  fillColor: '#f59e0b',
                  fillOpacity: 0.2,
                  strokeColor: '#f59e0b',
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  editable: true,
                  draggable: true,
                  zIndex: 20,
                }}
              />
            )}

            {/* Draft polygons (unsaved) — blue dashed */}
            {draftPolygons.map((draft, index) => (
              <React.Fragment key={`draft-${index}`}>
                {/* Glow */}
                <Polygon
                  paths={draft.paths}
                  options={{
                    fillColor: '#3b82f6',
                    fillOpacity: 0,
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.3,
                    strokeWeight: 8,
                    clickable: false,
                    zIndex: 3,
                  }}
                />
                {/* Main dashed */}
                <Polygon
                  paths={draft.paths}
                  options={{
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15,
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.9,
                    strokeWeight: 3,
                    clickable: false,
                    zIndex: 4,
                  }}
                />
              </React.Fragment>
            ))}
          </GoogleMap>
        </div>

        {/* Side Panel - Edit/Draft cards */}
        {(draftPolygons.length > 0 || editingId) && (
          <div className="absolute top-3 right-3 z-10 w-72 max-h-[calc(100%-24px)] overflow-y-auto space-y-2">
            {/* Editing existing */}
            {editingId && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-lg p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
                  Editing Zone
                </div>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Zone name"
                />
                <p className="text-[10px] text-slate-500 mb-2">
                  Drag vertices or the whole shape to edit the polygon boundary.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    disabled={isSaving || !editingName}
                    className="flex-1 rounded-xl font-extrabold text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelEdit}
                    className="rounded-xl font-extrabold text-xs gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Draft (new unsaved) polygons */}
            {draftPolygons.map((draft, index) => (
              <div
                key={`draft-panel-${index}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg p-3"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
                  New Zone {index + 1}
                </div>
                <div className="space-y-1.5 mb-2">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => handleUpdateDraft(index, { name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Zone name"
                  />
                  <input
                    type="text"
                    value={draft.code}
                    onChange={(e) =>
                      handleUpdateDraft(index, {
                        code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                    placeholder="ZONE_CODE"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mb-2">
                  {draft.paths.length} vertices
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveDraft(index)}
                    disabled={isSaving || !draft.name || !draft.code}
                    className="flex-1 rounded-xl font-extrabold text-xs gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveDraft(index)}
                    className="rounded-xl text-xs gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* District labels on map */}
        {districts
          .filter((d) => d.id !== editingId)
          .map((district) => {
            const paths = geoJsonToPaths(district.geoJson);
            if (paths.length === 0) return null;
            // Compute centroid for label
            const avgLat = paths.reduce((s, p) => s + p.lat, 0) / paths.length;
            const avgLng = paths.reduce((s, p) => s + p.lng, 0) / paths.length;
            return (
              <div
                key={`label-${district.id}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                {/* We skip inline labels — the side panel list shows names */}
              </div>
            );
          })}
      </div>
    </div>
  );
}
