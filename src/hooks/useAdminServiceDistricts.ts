import { useDataQuery, useCreate, usePatch, useDelete } from '@/lib/tanstack/dataQuery';
import { useQueryClient } from '@tanstack/react-query';

const BASE_URL = `${import.meta.env.VITE_API_URL}/api/serviceDistricts`;

export interface ServiceDistrict {
  id: string;
  code: string;
  name: string;
  active: boolean;
  geoJson: any;
  createdAt: string;
  updatedAt: string;
}

/** Fetch all service districts (admin) */
export function useAdminServiceDistricts() {
  const { data, isLoading, isError, error, refetch } = useDataQuery<ServiceDistrict[]>({
    apiEndPoint: BASE_URL,
    noFilter: true,
    staleTime: 2 * 60 * 1000,
  });

  return {
    districts: data || [],
    isLoading,
    isError,
    error,
    refetch,
  };
}

/** Create a new service district */
export function useCreateServiceDistrict(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useCreate<any, Partial<ServiceDistrict>>(BASE_URL, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['data', BASE_URL] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

/** Update a service district */
export function useUpdateServiceDistrict(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return usePatch<any, { id: string; data: Partial<ServiceDistrict> }>(
    `${BASE_URL}/:id`,
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['data', BASE_URL] });
        options?.onSuccess?.(data);
      },
      onError: options?.onError,
    },
  );
}

/** Delete a service district */
export function useDeleteServiceDistrict(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useDelete<any, { id: string }>(`${BASE_URL}/:id`, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data', BASE_URL] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

/** Convert a google.maps.Polygon path array to GeoJSON Feature */
export function polygonToGeoJson(
  paths: google.maps.MVCArray<google.maps.LatLng> | google.maps.LatLng[],
  properties?: Record<string, any>,
): any {
  const coords: [number, number][] = [];
  const path = 'getArray' in paths ? paths.getArray() : paths;

  path.forEach((latLng) => {
    coords.push([latLng.lng(), latLng.lat()]);
  });

  // Close the ring if not already closed
  if (coords.length > 0) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: properties || {
      type: 'pickup_zone',
    },
  };
}

/** Convert GeoJSON Feature to Google Maps LatLngLiteral array */
export function geoJsonToPaths(geoJson: any): google.maps.LatLngLiteral[] {
  if (!geoJson?.geometry?.coordinates) return [];

  const ring = geoJson.geometry.coordinates[0]; // outer ring
  return ring.map((coord: number[]) => ({
    lat: coord[1],
    lng: coord[0],
  }));
}
