import { useDataQuery } from '@/lib/tanstack/dataQuery';

interface PickupZone {
  id: string;
  code: string;
  name: string;
  geoJson: any;
}

export function usePickupZones() {
  const { data: zones, isLoading, isError } = useDataQuery<PickupZone[]>({
    apiEndPoint: `${import.meta.env.VITE_API_URL}/api/public/serviceDistricts`,
    noFilter: true,
    fetchWithoutRefresh: true,
    publicEndpoint: true,
  });

  return { zones: zones || [], isLoading, isError };
}
