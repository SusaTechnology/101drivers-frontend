// import React from "react";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

// const containerStyle = {
//   width: "100%",
//   height: "450px"
// };

// const center = { lat: 40.7128, lng: -74.0060 }; // New York

// export default function MapComponent() {
//   const { isLoaded } = useJsApiLoader({
//     googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
//     libraries: ["places"] // for search/autocomplete later
//   });

//   if (!isLoaded) return <div>Loading Map...</div>;

//   return (
//     <GoogleMap
//       mapContainerStyle={containerStyle}
//       center={center}
//       zoom={10}
//     >
//       <Marker position={center} />
//     </GoogleMap>
//   );
// }