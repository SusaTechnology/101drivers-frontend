import { useEffect, useRef, useState, useCallback } from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';

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
  /**
   * Fired when the user selects an address that is rejected because it
   * falls outside the configured `bounds` (when `strictBounds` is on).
   *
   * The component clears the input value and `onChange('')` is called
   * — this callback lets the parent show the user WHY the value was
   * cleared (e.g. "outside California, please enter a CA address").
   *
   * Optional. Existing callers that don't pass it behave exactly as
   * before (silent rejection).
   */
  onReject?: (reason: 'out-of-bounds') => void;
}

// All US state abbreviations except CA
const NON_CA_STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA',
  'WA','WV','WI','WY','DC','AS','GU','MP','PR','VI',
]);

// Full state names (except California) — Google sometimes uses these in terms
const NON_CA_STATE_NAMES = [
  'Alabama','Alaska','Arizona','Arkansas','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas',
  'Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
  'District of Columbia','American Samoa','Guam','Northern Mariana Islands',
  'Puerto Rico','Virgin Islands',
];

// Build a single regex that matches any non-CA state (abbr followed by comma/space/end, or full name)
const NON_CA_STATE_PATTERN = new RegExp(
  ',\\s*(' +
  [...NON_CA_STATE_ABBR].join('|') +
  ')(?:\\s*,|\\s*$)',
  'i'
);
const NON_CA_FULL_NAME_PATTERN = new RegExp(
  ',\\s*(' +
  NON_CA_STATE_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')(?:\\s*,|\\s*$)',
  'i'
);

function isNonCAPrediction(p: google.maps.places.AutocompletePrediction): boolean {
  // Check each term for state abbreviation (e.g. "NY", "DC")
  for (const term of p.terms) {
    if (NON_CA_STATE_ABBR.has(term.value.toUpperCase())) return true;
  }
  // Also check the full description text for full state names
  // (e.g. "Washington, District of Columbia, USA" won't have "DC" in terms)
  if (NON_CA_FULL_NAME_PATTERN.test(p.description)) return true;
  if (NON_CA_STATE_PATTERN.test(p.description)) return true;
  return false;
}

function filterToCA(
  predictions: google.maps.places.AutocompletePrediction[]
): google.maps.places.AutocompletePrediction[] {
  return predictions.filter((p) => !isNonCAPrediction(p));
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
  onReject,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // True when a prediction request failed (timeout / REQUEST_DENIED /
  // network error). The dropdown stays open with an explicit message and
  // a Retry button instead of silently closing — a vanishing dropdown
  // made users believe autocomplete was broken.
  const [loadError, setLoadError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Watchdog for getPlacePredictions: the Google callback can simply never
  // fire ( flaky network / throttled key ), which used to leave the loading
  // spinner spinning forever with no way out.
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id — responses from superseded requests are ignored,
  // so a slow stale reply can never overwrite a newer result (or unblock a
  // watchdog that no longer applies).
  const requestSeqRef = useRef(0);
  // Last query actually sent to Google — powers the Retry button.
  const lastQueryRef = useRef('');
  const userLocation = useUserLocation();
  
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

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  // Abort any in-flight request (used by clear / unmount) so a late
  // callback can't reopen or mutate the dropdown.
  const cancelPendingRequest = useCallback(() => {
    requestSeqRef.current += 1;
    clearWatchdog();
    setIsLoading(false);
  }, [clearWatchdog]);

  // Fetch predictions (US addresses only, no state restriction)
  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || !input.trim()) {
      cancelPendingRequest();
      setPredictions([]);
      setLoadError(false);
      setShowDropdown(false);
      return;
    }

    // Invalidate any in-flight request before issuing the new one.
    const seq = ++requestSeqRef.current;
    lastQueryRef.current = input;
    setIsLoading(true);
    setLoadError(false);
    // Show the dropdown immediately so the user sees the loading spinner
    // while Google is fetching predictions. Without this, the dropdown
    // only appears AFTER results come back — which means if Google returns
    // zero results (or is slow), the dropdown never shows and the user
    // thinks autocomplete is broken, forcing them to type the full address
    // manually. This was the original behavior before commit ed73911
    // inadvertently removed it.
    setShowDropdown(true);

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

    // Bias results toward the user's current GPS position (50 km radius).
    // Uses location + radius (soft bias) instead of locationBias because
    // the AutocompletionRequest.locationBias type does not support circles.
    if (userLocation) {
      request.location = { lat: userLocation.lat, lng: userLocation.lng };
      request.radius = 50000;
    }

    // Watchdog: if Google's callback hasn't fired within 8s, give up on
    // this request and surface an explicit error row with Retry. Without
    // this the spinner spun forever on flaky connections.
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (requestSeqRef.current !== seq) return; // superseded
      setIsLoading(false);
      setPredictions([]);
      setLoadError(true);
      setShowDropdown(true);
    }, 8000);

    autocompleteServiceRef.current.getPlacePredictions(request,
      (results, status) => {
        if (requestSeqRef.current !== seq) return; // stale response
        clearWatchdog();
        setIsLoading(false);

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          setPredictions([]);
          // Genuinely no matches keep the neutral "No addresses found"
          // row; anything else (denied, over quota, network) is a real
          // failure and gets the error row with Retry.
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            setLoadError(false);
            setShowDropdown(true);
          } else {
            setLoadError(true);
            setShowDropdown(true);
          }
          return;
        }

        // Client-side filter: Google's API doesn't reliably enforce strictBounds
        // on getPlacePredictions, so we double-check each prediction's state term.
        const filtered = strictBounds ? filterToCA(results) : results;

        setPredictions(filtered);
        setLoadError(false);
        // Keep the dropdown open even when filtering empties the list so
        // the user sees "No addresses found" instead of a silent vanish.
        setShowDropdown(true);
      }
    );
  }, [types, strictBounds, bounds, userLocation, cancelPendingRequest, clearWatchdog]);

  const handleRetryPredictions = useCallback(() => {
    if (lastQueryRef.current.trim()) {
      fetchPredictions(lastQueryRef.current);
    }
  }, [fetchPredictions]);

  // Clear pending network state on unmount (debounce timer + watchdog +
  // in-flight request id bump so late callbacks can't touch state).
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestSeqRef.current += 1;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

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

        // Hard-block: reject places outside bounds when strictBounds is enabled
        if (strictBounds && bounds && place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) {
            console.log('Address rejected: outside allowed region', { lat, lng, bounds });
            setInputValue('');
            onChangeRef.current('');
            onClear?.();
            // Notify the parent so it can show the user WHY the address was
            // cleared (e.g. "outside California — please enter a CA address").
            onReject?.('out-of-bounds');
            return;
          }
        }

        console.log('Selected address:', formattedAddress);
        
        setInputValue(formattedAddress);
        onChangeRef.current(formattedAddress);
        onPlaceSelectRef.current(place);
      }
    );
  }, [strictBounds, bounds, onClear]);

  // Handle focus
  const handleFocus = useCallback(() => {
    // Reopen on refocus when there is something worth showing: results,
    // or an error row (so Retry stays reachable after a tap elsewhere).
    if (inputValue.trim() && (predictions.length > 0 || loadError)) {
      setShowDropdown(true);
    }
  }, [inputValue, predictions.length, loadError]);

  // Handle clear
  const handleClear = useCallback(() => {
    cancelPendingRequest();
    setInputValue('');
    setPredictions([]);
    setLoadError(false);
    setShowDropdown(false);
    onChangeRef.current('');
    if (onClear) {
      onClear();
    }
  }, [onClear, cancelPendingRequest]);

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
          ) : loadError ? (
            <div className="p-4 text-center">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Couldn't load address suggestions
              </p>
              <button
                type="button"
                className="mt-2 text-sm font-bold text-lime-600 dark:text-lime-400 hover:underline"
                onClick={handleRetryPredictions}
              >
                Retry
              </button>
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
