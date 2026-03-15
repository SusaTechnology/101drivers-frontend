import { useEffect, useRef } from 'react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  isLoaded: boolean;
  icon?: React.ReactNode;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  isLoaded,
  icon,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Approximate bounds for California to bias results
  const californiaBounds = {
    north: 42.0,
    south: 32.5,
    east: -114.0,
    west: -124.5,
  };

  // Sync external value changes (e.g., demo button) to the input
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['address_components', 'geometry', 'formatted_address', 'place_id'],
      types: ['address'],
      componentRestrictions: { country: 'us' },
      bounds: californiaBounds, // Bias results to California
      strictBounds: false, // Don't strictly enforce, just bias
    });

    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.geometry && place.geometry.location) {
        onPlaceSelect(place);
        if (place.formatted_address && inputRef.current) {
          inputRef.current.value = place.formatted_address;
        }
      }
    });

    return () => {
      if (listener) listener.remove();
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onPlaceSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>}
      <input
        ref={inputRef}
        type="text"
        onChange={handleInputChange}
        placeholder={placeholder}
        className="h-14 pl-12 pr-4 rounded-2xl text-sm w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-lime-500"
      />
    </div>
  );
}