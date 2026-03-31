// import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

// const containerStyle = {
//   width: "100%",
//   height: "500px"
// };

// const center = {
//   lat: 9.03,
//   lng: 38.74
// };

// export default function Map() {
//   return (
//     <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
//       <GoogleMap
//         mapContainerStyle={containerStyle}
//         center={center}
//         zoom={12}
//       >
//         <Marker position={center} />
//       </GoogleMap>
//     </LoadScript>
//   );
// }

// components/Map.tsx
import { GoogleMap, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px',
};

interface MapProps {
  center?: { lat: number; lng: number };
  markers?: Array<{ lat: number; lng: number; label?: string }>;
  zoom?: number;
}

export function Map({ center = { lat: 40.7128, lng: -74.0060 }, markers = [], zoom = 12 }: MapProps) {
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
    >
      {markers.map((marker, idx) => (
        <Marker key={idx} position={marker} label={marker.label} />
      ))}
    </GoogleMap>
  );
}