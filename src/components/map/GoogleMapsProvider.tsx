// // components/GoogleMapsProvider.tsx
// import { useJsApiLoader, type Libraries } from '@react-google-maps/api';

// const libraries: Libraries = ['places']; // add 'places' if you need autocomplete

// export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
//   const { isLoaded, loadError } = useJsApiLoader({
//     googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
//     libraries,
//   });

//   if (loadError) return <div>Error loading maps</div>;
//   if (!isLoaded) return <div>Loading maps...</div>;

//   return <>{children}</>;
// }