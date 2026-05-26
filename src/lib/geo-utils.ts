// Point-in-polygon using ray-casting algorithm
// point: [lat, lng], polygon: Array of [lat, lng]
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lati, lngi] = polygon[i];
    const [latj, lngj] = polygon[j];
    const intersect = ((lati > lat) !== (latj > lat)) && (lng < (lngj - lngi) * (lat - lati) / (latj - lati) + lngi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Convert GeoJSON [lng, lat] polygon to [lat, lng] for our usage
export function geoJsonToLatLng(coords: number[][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng]);
}

// Check if a point is inside any zone
export function isInPickupZone(lat: number, lng: number, zones: any[]): { inZone: boolean; matchedZone: any | null } {
  for (const zone of zones) {
    if (!zone.geoJson?.geometry?.coordinates) continue;
    const ring = zone.geoJson.geometry.coordinates[0]; // outer ring
    const polygon = geoJsonToLatLng(ring);
    if (pointInPolygon([lat, lng], polygon)) {
      return { inZone: true, matchedZone: zone };
    }
  }
  return { inZone: false, matchedZone: null };
}
