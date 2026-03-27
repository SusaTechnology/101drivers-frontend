import { useEffect, useRef } from 'react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  isLoaded: boolean;
  icon?: React.ReactNode;
  className?: string;
  /** 
   * Types of places to suggest:
   * - 'address' - Street addresses only (default, best for delivery locations)
   * - 'geocode' - Addresses, cities, ZIP codes (good for home area/city selection)
   * - 'establishment' - Businesses and landmarks
   */
  types?: string[];
  /** Label for screen readers */
  label?: string;
  /** Disable the input */
  disabled?: boolean;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  isLoaded,
  icon,
  className = '',
  types = ['address'], // Default to street addresses only
  label,
  disabled = false,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Use refs for callbacks to avoid re-initializing autocomplete on every render
  // This is critical because parent components often pass inline arrow functions
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onChange, onPlaceSelect]);

  // Strict bounds for California only
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

  // Initialize Google Places Autocomplete - only reinitialize when truly necessary
  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['address_components', 'geometry', 'formatted_address', 'place_id'],
      types: types as any,
      componentRestrictions: { country: 'us' },
      bounds: californiaBounds,
      strictBounds: true, // STRICTLY enforce California only
    });

    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.geometry && place.geometry.location) {
        // Verify the place is in California by checking address components
        const addressComponents = place.address_components || [];
        const isInCalifornia = addressComponents.some(
          (component) => 
            component.types.includes('administrative_area_level_1') && 
            component.short_name === 'CA'
        );
        
        if (!isInCalifornia) {
          // Clear the input and show error for non-California locations
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          onChangeRef.current('');
          return;
        }
        
        onPlaceSelectRef.current(place);
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
  }, [isLoaded, types, disabled]); // Removed onChange and onPlaceSelect from deps - using refs instead

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeRef.current(e.target.value);
  };

  return (
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>}
      <input
        ref={inputRef}
        type="text"
        onChange={handleInputChange}
        placeholder={placeholder}
        aria-label={label || placeholder}
        disabled={disabled}
        className={`h-14 pl-12 pr-4 rounded-2xl text-sm w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-lime-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
    </div>
  );
}
