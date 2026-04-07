// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useJsApiLoader } from '@react-google-maps/api';
import {
  MapPin,
  ArrowLeft,
  Trash2,
  Edit3,
  Power,
  PowerOff,
  Plus,
  Info,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Map as MapIcon,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import DistrictDrawingMap from '@/components/map/DistrictDrawingMap';
import {
  useAdminServiceDistricts,
  useCreateServiceDistrict,
  useUpdateServiceDistrict,
  useDeleteServiceDistrict,
  ServiceDistrict,
} from '@/hooks/useAdminServiceDistricts';

export default function AdminServiceDistrictsPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<ServiceDistrict | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Data hooks
  const { districts, isLoading, refetch } = useAdminServiceDistricts();
  const createDistrict = useCreateServiceDistrict({
    onSuccess: () => {
      toast.success('District created', { description: 'Service district has been saved.' });
      refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to create district', { description: error.message });
    },
  });

  const updateDistrict = useUpdateServiceDistrict({
    onSuccess: () => {
      toast.success('District updated', { description: 'Changes have been saved.' });
      refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to update district', { description: error.message });
    },
  });

  const deleteDistrict = useDeleteServiceDistrict({
    onSuccess: () => {
      toast.success('District deleted');
      setDeleteDialogOpen(false);
      setDistrictToDelete(null);
      refetch();
    },
    onError: (error: Error) => {
      toast.error('Failed to delete district', { description: error.message });
    },
  });

  // Google Maps loading
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-admin-districts',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['geometry', 'places', 'drawing'],
  });

  // Handlers
  const handleCreateDistrict = useCallback(
    (data: { code: string; name: string; active: boolean; geoJson: any }) => {
      createDistrict.mutate(data);
    },
    [createDistrict],
  );

  const handleUpdateDistrict = useCallback(
    (id: string, data: { name?: string; active?: boolean; geoJson?: any }) => {
      updateDistrict.mutate({ id, data });
    },
    [updateDistrict],
  );

  const handleToggleActive = useCallback(
    (district: ServiceDistrict) => {
      updateDistrict.mutate({
        id: district.id,
        data: { active: !district.active },
      });
    },
    [updateDistrict],
  );

  const handleDeleteClick = useCallback((district: ServiceDistrict) => {
    setDistrictToDelete(district);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!districtToDelete) return;
    deleteDistrict.mutate({ id: districtToDelete.id });
  }, [districtToDelete, deleteDistrict]);

  // Filter districts
  const filteredDistricts = districts.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeCount = districts.filter((d) => d.active).length;
  const inactiveCount = districts.filter((d) => !d.active).length;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans antialiased text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => navigate({ to: '/admin-config' })}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Service Districts
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex">
              <CheckCircle className="w-3 h-3 text-emerald-500 mr-1" />
              {activeCount} active
            </Badge>
            {inactiveCount > 0 && (
              <Badge variant="outline" className="hidden sm:flex text-slate-400">
                <PowerOff className="w-3 h-3 mr-1" />
                {inactiveCount} inactive
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 lg:py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Total
              </div>
              <div className="text-2xl font-black mt-1">{districts.length}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                Active
              </div>
              <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Inactive
              </div>
              <div className="text-2xl font-black mt-1">{inactiveCount}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Vertices
              </div>
              <div className="text-2xl font-black mt-1">
                {districts.reduce((sum, d) => {
                  try {
                    return (
                      sum +
                      (d.geoJson?.geometry?.coordinates?.[0]?.length || 0)
                    );
                  } catch {
                    return sum;
                  }
                }, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 mb-6">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            <strong>Drawing zones:</strong> Click "Draw New Zone" then click points on the map to create a polygon. Double-click or click the first point to close the shape. 
            Existing zones appear in green. Zones being edited appear in amber. Unsaved new zones appear in blue (dashed).
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition',
              activeTab === 'map'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <MapIcon className="h-4 w-4" />
            Map Editor
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition',
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <Eye className="h-4 w-4" />
            List View
          </button>
        </div>

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[600px] lg:h-[700px]">
                {!isLoaded ? (
                  <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                      <p className="text-sm text-slate-500 mt-3">Loading Google Maps...</p>
                    </div>
                  </div>
                ) : (
                  <DistrictDrawingMap
                    districts={districts}
                    onSave={handleCreateDistrict}
                    onUpdate={handleUpdateDistrict}
                    onDelete={(id) => {
                      const d = districts.find((d) => d.id === id);
                      if (d) handleDeleteClick(d);
                    }}
                    isSaving={createDistrict.isPending || updateDistrict.isPending}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* LIST TAB */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search districts by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md pl-9 rounded-xl"
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : filteredDistricts.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-10 text-center">
                  <MapPin className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3">
                    {searchQuery ? 'No districts match your search.' : 'No service districts yet.'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-slate-400 mt-1">
                      Switch to the Map Editor tab to draw your first zone.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredDistricts.map((district) => (
                  <Card
                    key={district.id}
                    className={cn(
                      'border transition',
                      district.active
                        ? 'border-emerald-200 dark:border-emerald-900/40'
                        : 'border-slate-200 dark:border-slate-800 opacity-60',
                    )}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                              district.active
                                ? 'bg-emerald-50 dark:bg-emerald-900/15'
                                : 'bg-slate-100 dark:bg-slate-800',
                            )}
                          >
                            <MapPin
                              className={cn(
                                'h-5 w-5',
                                district.active
                                  ? 'text-emerald-500'
                                  : 'text-slate-400',
                              )}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {district.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className="text-[9px] font-mono font-bold uppercase"
                              >
                                {district.code}
                              </Badge>
                              <Badge
                                className={cn(
                                  'text-[9px] font-black',
                                  district.active
                                    ? 'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
                                )}
                              >
                                {district.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {(() => {
                                try {
                                  const v = district.geoJson?.geometry?.coordinates?.[0]?.length || 0;
                                  return `${v} vertices • Created ${new Date(district.createdAt).toLocaleDateString()}`;
                                } catch {
                                  return `Created ${new Date(district.createdAt).toLocaleDateString()}`;
                                }
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(district)}
                            className="rounded-xl text-xs font-bold gap-1.5"
                          >
                            {district.active ? (
                              <>
                                <PowerOff className="h-3.5 w-3.5" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="h-3.5 w-3.5" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTab('map')}
                            className="rounded-xl text-xs font-bold gap-1.5"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit on Map
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(district)}
                            className="rounded-xl text-xs font-bold gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Service District
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The district polygon and all associated
              driver preferences will be permanently removed.
            </DialogDescription>
          </DialogHeader>

          {districtToDelete && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-red-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm">{districtToDelete.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {districtToDelete.code}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDistrictToDelete(null);
              }}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteDistrict.isPending}
              className="rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteDistrict.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Delete District
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
