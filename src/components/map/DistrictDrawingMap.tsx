// @ts-nocheck
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, DrawingManager, Polygon, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, X, Undo2, MousePointerClick, Plus, GripVertical, Move } from 'lucide-react';
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
  const [editVertexCount, setEditVertexCount] = useState(0);

  // For the click-to-edit tooltip
  const [tooltipDistrict, setTooltipDistrict] = useState<District | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<google.maps.LatLng | null>(null);

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
      editPolygonRef.current = null;
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
  const startEdit = useCallback(
    (district: District) => {
      setEditingId(district.id || null);
      setEditingName(district.name);
      setTooltipDistrict(null);
      setTooltipAnchor(null);
      setDrawingMode(false);
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(null);
      }
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
    editPolygonRef.current = null;
    setEditVertexCount(0);
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
    setEditVertexCount(0);
  }, [editingId, editingName, onUpdate]);

  // Track vertex count on the edit polygon
  const handleEditPolygonLoad = useCallback(
    (poly: google.maps.Polygon) => {
      editPolygonRef.current = poly;
      const count = poly.getPath().getLength();
      setEditVertexCount(count);

      // Listen for vertex changes
      google.maps.event.clearListeners(poly, 'dragend');
      google.maps.event.addListener(poly.getPath(), 'insert_at', () => {
        setEditVertexCount(poly.getPath().getLength());
      });
      google.maps.event.addListener(poly.getPath(), 'remove_at', () => {
        setEditVertexCount(poly.getPath().getLength());
      });
      google.maps.event.addListener(poly.getPath(), 'set_at', () => {
        setEditVertexCount(poly.getPath().getLength());
      });
    },
    [],
  );

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

  // Click on polygon to start editing
  const handlePolygonClick = useCallback(
    (e: google.maps.MapMouseEvent, district: District) => {
      if (drawingMode) return;
      startEdit(district);
    },
    [drawingMode, startEdit],
  );

  // Hover to show tooltip
  const handlePolygonMouseOver = useCallback(
    (e: google.maps.MapMouseEvent, district: District) => {
      if (drawingMode) return;
      setHoveredDistrict(district.id || null);
      setTooltipDistrict(district);
      if (e.latLng) {
        setTooltipAnchor(e.latLng);
      }
    },
    [drawingMode],
  );

  const handlePolygonMouseOut = useCallback(() => {
    setHoveredDistrict(null);
    setTooltipDistrict(null);
    setTooltipAnchor(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <Button
          size="sm"
          variant={drawingMode ? 'default' : 'outline'}
          onClick={toggleDrawing}
          disabled={!!editingId}
          className="rounded-xl font-extrabold text-xs gap-1.5"
        >
          {drawingMode ? (
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

        {drawingMode && (
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

        {!drawingMode && !editingId && (
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

        {(totalVertices > 0 || editVertexCount > 0) && (
          <span className="text-[10px] text-slate-400 font-medium">
            {totalVertices + editVertexCount} vertices total
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

            {/* Existing districts (non-editing) */}
            {districts.map((district) => {
              const paths = geoJsonToPaths(district.geoJson);
              if (paths.length === 0) return null;

              const isEditing = editingId === district.id;
              const isHovered = hoveredDistrict === district.id;

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
                      strokeOpacity: isHovered ? 0.5 : 0.3,
                      strokeWeight: 8,
                      clickable: !drawingMode,
                      zIndex: 1,
                      cursor: drawingMode ? 'default' : 'pointer',
                    }}
                  />
                  {/* Main fill */}
                  <Polygon
                    paths={paths}
                    options={{
                      fillColor: '#a9ce42',
                      fillOpacity: isHovered ? 0.35 : 0.2,
                      strokeColor: '#a9ce42',
                      strokeOpacity: isHovered ? 1 : 0.9,
                      strokeWeight: isHovered ? 4 : 3,
                      clickable: !drawingMode,
                      zIndex: 2,
                      cursor: drawingMode ? 'default' : 'pointer',
                    }}
                    onMouseover={(e) => handlePolygonMouseOver(e, district)}
                    onMouseout={handlePolygonMouseOut}
                    onClick={(e) => handlePolygonClick(e, district)}
                  />
                </React.Fragment>
              );
            })}

            {/* Click-to-edit tooltip */}
            {tooltipDistrict && tooltipAnchor && !editingId && !drawingMode && (
              <InfoWindow
                position={tooltipAnchor}
                options={{
                  pixelOffset: new google.maps.Size(0, -10),
                  maxWidth: 200,
                  closeIcon: { url: '' } as any,
                  disableAutoPan: true,
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    fontFamily: 'system-ui, sans-serif',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    margin: '-8px -12px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '12px', color: '#1e293b', marginBottom: '2px' }}>
                    {tooltipDistrict.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                    {tooltipDistrict.code} · {tooltipDistrict.active ? '● Active' : '○ Inactive'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>
                    ✏️ Click to edit this zone
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Edit polygon overlay (when editing existing) */}
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

            {/* Draft polygons (unsaved) — blue */}
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
                {/* Main */}
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
          <div className="absolute top-3 right-3 z-10 w-80 max-h-[calc(100%-24px)] overflow-y-auto space-y-2">
            {/* Editing existing */}
            {editingId && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-lg p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">
                  ✏️ Editing Zone
                </div>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Zone name"
                />
                
                {/* Edit instructions */}
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 mb-3 space-y-2">
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

                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-3">
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
                    Save Changes
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg p-4"
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

        {/* Quick-help overlay when map is idle (no edit, no draw) */}
        {!editingId && !drawingMode && draftPolygons.length === 0 && districts.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg px-4 py-2.5 flex items-center gap-3">
              <MousePointerClick className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Click any zone to edit · Drag vertices to reshape · Right-click vertex to delete
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
