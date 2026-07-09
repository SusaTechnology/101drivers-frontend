// @ts-nocheck
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, Polygon, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, X, Undo2, MousePointerClick, Plus, GripVertical, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const editPolygonRef = useRef<google.maps.Polygon | null>(null);

  // Drawing state (manual, no DrawingManager)
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<google.maps.LatLngLiteral[]>([]);

  const [draftPolygons, setDraftPolygons] = useState<DraftPolygon[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editVertexCount, setEditVertexCount] = useState(0);

  // Popup for click on polygon
  const [popupDistrict, setPopupDistrict] = useState<District | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<google.maps.LatLng | null>(null);

  // Side panel state — collapsible + draggable so it doesn't block the map
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Drag handlers for the side panel
  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from the header bar, not from inputs/buttons
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) return;
    setPanelDragging(true);
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panelDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    if (!panelDragging) return;
    const handleMove = (e: MouseEvent) => {
      setPanelPos({ x: e.clientX - panelDragOffset.current.x, y: e.clientY - panelDragOffset.current.y });
    };
    const handleUp = () => setPanelDragging(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [panelDragging]);

  // Total vertices from draft polygons (for toolbar badge)
  const totalVertices = draftPolygons.reduce((sum, dp) => sum + dp.paths.length, 0);

  // Store map ref
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Map click/dblclick handlers (manual drawing)
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawingMode || !e.latLng) return;
      const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      const points = drawingPoints;

      // Check if clicking near the first point to close polygon
      if (points.length >= 3) {
        const first = points[0];
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(first.lat, first.lng),
          e.latLng,
        );
        if (dist < 10) {
          // Close polygon – finish drawing
          setIsDrawingMode(false);
          const newDraft: DraftPolygon = {
            paths: [...points],
            code: `ZONE_${draftPolygons.length + 1}`,
            name: `Zone ${draftPolygons.length + 1}`,
          };
          setDraftPolygons((prev) => [...prev, newDraft]);
          setDrawingPoints([]);
          return;
        }
      }

      // Add point
      setDrawingPoints((prev) => [...prev, latLng]);
    },
    [isDrawingMode, drawingPoints, draftPolygons.length],
  );

  const handleMapDblClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawingMode) return;
      e.stop();
      if (drawingPoints.length >= 3) {
        setIsDrawingMode(false);
        const newDraft: DraftPolygon = {
          paths: [...drawingPoints],
          code: `ZONE_${draftPolygons.length + 1}`,
          name: `Zone ${draftPolygons.length + 1}`,
        };
        setDraftPolygons((prev) => [...prev, newDraft]);
        setDrawingPoints([]);
      }
    },
    [isDrawingMode, drawingPoints, draftPolygons.length],
  );

  // Attach/detach map listeners when drawing mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isDrawingMode) {
      const clickListener = map.addListener('click', handleMapClick);
      const dblClickListener = map.addListener('dblclick', handleMapDblClick);
      return () => {
        google.maps.event.removeListener(clickListener);
        google.maps.event.removeListener(dblClickListener);
      };
    }
    return () => {}; // no listeners when not drawing
  }, [isDrawingMode, handleMapClick, handleMapDblClick]);

  // Toggle drawing mode on/off
  const toggleDrawing = useCallback(() => {
    if (isDrawingMode) {
      // Cancel drawing
      setIsDrawingMode(false);
      setDrawingPoints([]);
    } else {
      // Start drawing
      setIsDrawingMode(true);
      setEditingId(null);
      setPopupDistrict(null);
      setPopupAnchor(null);
      editPolygonRef.current = null;
    }
  }, [isDrawingMode]);

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

  // Start editing an existing district
  const startEdit = useCallback((district: District) => {
    setEditingId(district.id || null);
    setEditingName(district.name);
    setPopupDistrict(null);
    setPopupAnchor(null);
    setIsDrawingMode(false);
    setDrawingPoints([]);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
    editPolygonRef.current = null;
    setEditVertexCount(0);
  }, []);

  // Save edited polygon
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
      onUpdate?.(editingId, { name: editingName });
    }
    setEditingId(null);
    setEditingName('');
    editPolygonRef.current = null;
    setEditVertexCount(0);
  }, [editingId, editingName, onUpdate]);

  // Track vertex count on edit polygon
  const handleEditPolygonLoad = useCallback((poly: google.maps.Polygon) => {
    editPolygonRef.current = poly;
    setEditVertexCount(poly.getPath().getLength());

    const updateCount = () => setEditVertexCount(poly.getPath().getLength());
    google.maps.event.clearListeners(poly.getPath(), 'insert_at');
    google.maps.event.clearListeners(poly.getPath(), 'remove_at');
    google.maps.event.clearListeners(poly.getPath(), 'set_at');
    poly.getPath().addListener('insert_at', updateCount);
    poly.getPath().addListener('remove_at', updateCount);
    poly.getPath().addListener('set_at', updateCount);
  }, []);

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

    // Include drawing preview if any
    if (isDrawingMode && drawingPoints.length > 0) {
      drawingPoints.forEach((p) => bounds.extend(p));
      hasAny = true;
    }

    if (hasAny) {
      const mapDiv = mapRef.current.getDiv();
      const padV = Math.round(mapDiv.clientHeight * 0.12);
      const padH = Math.round(mapDiv.clientWidth * 0.08);
      mapRef.current.fitBounds(bounds, { top: padV, right: padH, bottom: padV, left: padH });
    }
  }, [districts, draftPolygons, isDrawingMode, drawingPoints]);

  // Auto-fit when districts load
  useEffect(() => {
    if (districts.length > 0 && !editingId && draftPolygons.length === 0 && !isDrawingMode) {
      const timer = setTimeout(fitAllBounds, 500);
      return () => clearTimeout(timer);
    }
  }, [districts, editingId, draftPolygons, isDrawingMode, fitAllBounds]);

  // Edit paths for the polygon being edited
  const editPaths = editingId
    ? geoJsonToPaths(districts.find((d) => d.id === editingId)?.geoJson)
    : [];

  // Polygon click popup
  const handlePolygonClick = useCallback(
    (e: google.maps.MapMouseEvent, district: District) => {
      if (isDrawingMode) return;
      if (popupDistrict?.id === district.id) {
        setPopupDistrict(null);
        setPopupAnchor(null);
      } else {
        setPopupDistrict(district);
        if (e.latLng) setPopupAnchor(e.latLng);
      }
    },
    [isDrawingMode, popupDistrict],
  );

  const closePopup = useCallback(() => {
    setPopupDistrict(null);
    setPopupAnchor(null);
  }, []);

  const handlePopupEdit = useCallback(
    (district: District) => {
      setPopupDistrict(null);
      setPopupAnchor(null);
      startEdit(district);
    },
    [startEdit],
  );

  const handlePopupDelete = useCallback(
    (district: District) => {
      if (district.id) onDelete?.(district.id);
      setPopupDistrict(null);
      setPopupAnchor(null);
    },
    [onDelete],
  );

  const handlePolygonMouseOver = useCallback(
    (e: google.maps.MapMouseEvent, district: District) => {
      if (isDrawingMode) return;
      setHoveredDistrict(district.id || null);
    },
    [isDrawingMode],
  );

  const handlePolygonMouseOut = useCallback(() => {
    setHoveredDistrict(null);
  }, []);

  // Preview polygon while drawing
  const drawingPreview = isDrawingMode && drawingPoints.length >= 2
    ? (drawingPoints.length >= 3 ? [...drawingPoints, drawingPoints[0]] : drawingPoints)
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <Button
          size="sm"
          variant={isDrawingMode ? 'default' : 'outline'}
          onClick={toggleDrawing}
          disabled={!!editingId}
          className="rounded-xl font-extrabold text-xs gap-1.5"
        >
          {isDrawingMode ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel Drawing
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
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

        {isDrawingMode && (
          <Badge className="bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-black">
            Click points on the map to draw a polygon. Double-click to finish.
          </Badge>
        )}

        {editingId && (
          <Badge className="bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-black">
            <GripVertical className="h-3 w-3 mr-1" />
            Drag vertices to reshape · Click edge to add vertex · Right-click vertex to delete
          </Badge>
        )}

        {!isDrawingMode && !editingId && (
          <Badge variant="secondary" className="text-[10px] font-black text-slate-500">
            <MousePointerClick className="h-3 w-3 mr-1" />
            Click any zone on the map to edit it
          </Badge>
        )}

        {draftPolygons.length > 0 && (
          <Badge variant="secondary" className="text-[10px] font-black">
            {draftPolygons.length} unsaved zone{draftPolygons.length > 1 ? 's' : ''}
          </Badge>
        )}

        {/* Zone selector — pick any zone by name when they're layered on top of each other */}
        {!isDrawingMode && !editingId && districts.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const d = districts.find((d) => d.id === e.target.value);
              if (d) {
                setPopupDistrict(d);
                const paths = geoJsonToPaths(d.geoJson);
                if (paths.length > 0 && mapRef.current) {
                  const bounds = new google.maps.LatLngBounds();
                  paths.forEach((p) => bounds.extend(p));
                  mapRef.current.fitBounds(bounds, 60);
                  // Set popup anchor to the first vertex so the Edit/Delete popup appears
                  setPopupAnchor(new google.maps.LatLng(paths[0].lat, paths[0].lng));
                }
              }
            }}
            className="text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 max-w-[160px]"
          >
            <option value="">Select zone…</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        )}

        {(totalVertices > 0 || editVertexCount > 0) && (
          <span className="text-[10px] text-slate-400 font-medium">
            {totalVertices + editVertexCount} vertices total
          </span>
        )}
      </div>

      {/* Map + Side Panel */}
      <div className="flex flex-1 min-h-0 relative">
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
            {/* Existing districts (non‑editing) */}
            {districts.map((district) => {
              const paths = geoJsonToPaths(district.geoJson);
              if (paths.length === 0) return null;
              const isEditing = editingId === district.id;
              if (isEditing) return null;

              return (
                <React.Fragment key={district.id}>
                  {/* Glow border */}
                  <Polygon
                    paths={paths}
                    options={{
                      fillColor: '#a9ce42',
                      fillOpacity: 0,
                      strokeColor: '#a9ce42',
                      strokeOpacity: hoveredDistrict === district.id ? 0.5 : 0.3,
                      strokeWeight: 8,
                      clickable: !isDrawingMode,
                      zIndex: 1,
                      cursor: isDrawingMode ? 'default' : 'pointer',
                    }}
                  />
                  {/* Main fill */}
                  <Polygon
                    paths={paths}
                    options={{
                      fillColor: '#a9ce42',
                      fillOpacity: hoveredDistrict === district.id ? 0.35 : 0.2,
                      strokeColor: '#a9ce42',
                      strokeOpacity: hoveredDistrict === district.id ? 1 : 0.9,
                      strokeWeight: hoveredDistrict === district.id ? 4 : 3,
                      clickable: !isDrawingMode,
                      zIndex: 2,
                      cursor: isDrawingMode ? 'default' : 'pointer',
                    }}
                    onMouseover={(e) => handlePolygonMouseOver(e, district)}
                    onMouseout={handlePolygonMouseOut}
                    onClick={(e) => handlePolygonClick(e, district)}
                  />
                </React.Fragment>
              );
            })}

            {/* Popup for click actions (Edit/Delete) */}
            {popupDistrict && popupAnchor && !editingId && !isDrawingMode && (
              <InfoWindow
                position={popupAnchor}
                options={{
                  pixelOffset: new google.maps.Size(0, -10),
                  maxWidth: 240,
                  disableAutoPan: true,
                }}
                onCloseClick={closePopup}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    padding: '0',
                    fontFamily: 'system-ui, sans-serif',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    margin: '-8px -12px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', marginBottom: '2px' }}>
                      {popupDistrict.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                      {popupDistrict.code}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', padding: '8px 10px 10px' }}>
                    <button
                      onClick={() => handlePopupEdit(popupDistrict)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#fffbeb',
                        color: '#92400e',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handlePopupDelete(popupDistrict)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        borderRadius: '10px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#991b1b',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Edit polygon (editing existing) */}
            {editingId && editPaths.length > 0 && (
              <Polygon
                onLoad={handleEditPolygonLoad}
                paths={editPaths}
                options={{
                  fillColor: '#f59e0b',
                  fillOpacity: 0.15,
                  strokeColor: '#f59e0b',
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  editable: true,
                  draggable: true,
                  zIndex: 20,
                }}
              />
            )}

            {/* Draft polygons (unsaved) – blue */}
            {draftPolygons.map((draft, index) => (
              <React.Fragment key={`draft-${index}`}>
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

            {/* Drawing preview (current drawing) */}
            {isDrawingMode && drawingPreview.length > 0 && (
              <Polygon
                paths={drawingPreview}
                options={{
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1,
                  strokeColor: '#3b82f6',
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                  strokeDasharray: '6 4',
                  clickable: false,
                  editable: false,
                  zIndex: 5,
                }}
              />
            )}
          </GoogleMap>
        </div>

        {/* Side Panel - Edit/Draft cards (draggable + collapsible) */}
        {(draftPolygons.length > 0 || editingId) && (
          <div
            ref={panelRef}
            className={cn(
              "absolute z-20 w-80 max-h-[calc(100%-24px)] overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
              panelDragging && "cursor-grabbing"
            )}
            style={{
              top: panelPos.y || 12,
              right: panelPos.x === 0 ? 12 : 'auto',
              left: panelPos.x !== 0 ? panelPos.x : 'auto',
            }}
          >
            {/* Drag header bar */}
            <div
              onMouseDown={handlePanelDragStart}
              className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-400" />
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                  {editingId ? 'Edit Zone' : `${draftPolygons.length} New Zone${draftPolygons.length > 1 ? 's' : ''}`}
                </span>
              </div>
              <button
                onClick={() => setPanelCollapsed(!panelCollapsed)}
                className="w-6 h-6 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition"
                aria-label={panelCollapsed ? 'Expand panel' : 'Minimize panel'}
              >
                {panelCollapsed ? <Plus className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Collapsible body */}
            {!panelCollapsed && (
              <div className="overflow-y-auto max-h-[calc(100%-40px)] space-y-2 p-2">
                {/* Editing existing */}
                {editingId && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
                      ✏️ Editing Zone
                    </div>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Zone name"
                    />

                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-2.5 mb-2 space-y-1.5">
                      <div className="text-[10px] font-black text-amber-700 dark:text-amber-300">
                        How to edit:
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <GripVertical className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Drag vertices</strong> — white dots on the boundary to reshape the zone</span>
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <Move className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Drag the whole shape</strong> — click inside and drag to reposition</span>
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <Plus className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Click an edge</strong> — between two vertices to add a new point</span>
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <Trash2 className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span><strong>Right-click a vertex</strong> — to remove it from the polygon</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                      <span>{editVertexCount} vertices</span>
                    </div>

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
                    className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 p-3"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
                      🆕 New Zone {index + 1}
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
                    <p className="text-[10px] text-slate-500 mb-2">{draft.paths.length} vertices</p>
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
          </div>
        )}

        {/* Quick‑help overlay when idle */}
        {!editingId && !isDrawingMode && draftPolygons.length === 0 && districts.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg px-4 py-2.5 flex items-center gap-3">
              <MousePointerClick className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Click any zone to Edit or Delete · Hover to highlight
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}