import { useEffect, useRef, useState, useCallback } from 'react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  onClear?: () => void;
  placeholder?: string;
  isLoaded: boolean;
  icon?: React.ReactNode;
  className?: string;
  types?: string[];
  label?: string;
  disabled?: boolean;
  /** If true + bounds set, autocomplete only returns results inside bounds */
  strictBounds?: boolean;
  /** LatLngBoundsLiteral to bias or restrict autocomplete results */
  bounds?: google.maps.LatLngBoundsLiteral;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  onClear,
  placeholder,
  isLoaded,
  icon,
  className = '',
  types = ['address'],
  label,
  disabled = false,
  strictBounds = false,
  bounds,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs for callbacks
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  // Keep refs updated
  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onChange, onPlaceSelect]);

  // Initialize services
  useEffect(() => {
    if (!isLoaded) return;
    
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    const dummyDiv = document.createElement('div');
    placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    
    console.log('Places services initialized');
  }, [isLoaded]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch predictions (US addresses only, no state restriction)
  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || !input.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);

    const request: google.maps.places.AutocompletionRequest = {
        input,
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
      };

    // Apply bounds restriction when provided
    if (bounds) {
      request.bounds = bounds;
      request.strictBounds = strictBounds;
    }

    autocompleteServiceRef.current.getPlacePredictions(request,
      (results, status) => {
        setIsLoading(false);
        
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          setPredictions([]);
          setShowDropdown(false);
          return;
        }

        setPredictions(results);
        setShowDropdown(results.length > 0);
      }
    );
  }, [types, strictBounds, bounds]);

  // Handle input change with debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChangeRef.current(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the prediction fetch
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  }, [fetchPredictions]);

  // Handle prediction selection
  const handleSelectPrediction = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    setInputValue(prediction.description);
    setShowDropdown(false);
    setIsLoading(true);

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'geometry', 'formatted_address', 'place_id', 'name'],
      },
      (place, status) => {
        setIsLoading(false);
        
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          console.log('Failed to get place details');
          return;
        }

        const formattedAddress = place.formatted_address || prediction.description;
        
        console.log('Selected address:', formattedAddress);
        
        setInputValue(formattedAddress);
        onChangeRef.current(formattedAddress);
        onPlaceSelectRef.current(place);
      }
    );
  }, []);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (inputValue.trim() && predictions.length > 0) {
      setShowDropdown(true);
    }
  }, [inputValue, predictions.length]);

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue('');
    setPredictions([]);
    setShowDropdown(false);
    onChangeRef.current('');
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  return (
    <div ref={wrapperRef} className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        aria-label={label || placeholder}
        disabled={disabled}
        className={`h-14 pl-12 pr-10 rounded-2xl text-sm w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-lime-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
      
      {/* Clear button */}
      {inputValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClear();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
          aria-label="Clear address"
        >
          <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lime-500 mx-auto"></div>
            </div>
          ) : predictions.length > 0 ? (
            predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                onClick={() => handleSelectPrediction(prediction)}
              >
                <div className="w-8 h-8 rounded-lg bg-lime-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {prediction.structured_formatting.main_text}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              No addresses found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
