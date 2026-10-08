/**
 * SETTINGS-ONLY address autocomplete + hidden map.
 *
 * IMPORTANT: This file exists because the dealer settings page must NOT
 * change the shared `LocationAutocomplete.tsx` — that component is used by
 * the public page and dealer-create-delivery, and edits to it ripple into
 * those pages. Everything here is self-contained.
 *
 * Why a hidden map? On this page the Google dropdown kept failing while the
 * SAME component worked on pages that also render a <GoogleMap>. Rendering
 * a real (invisible) map forces the Maps JS API to fully initialize on this
 * page too, instead of only exposing the Places services.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { useUserLocation } from '@/hooks/useUserLocation';

interface SettingsAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  onClear?: () => void;
  placeholder?: string;
  isLoaded: boolean;
  icon?: React.ReactNode;
  className?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * A 1×1 px, fully invisible GoogleMap. Rendered ONCE per page (place it
 * anywhere inside the page body). It has no visual footprint and no
 * interactivity — its only job is to make the Maps runtime fully initialize
 * on pages that otherwise never mount a map.
 */
export function HiddenGoogleMap({ isLoaded }: { isLoaded: boolean }) {
  if (!isLoaded) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 opacity-0"
      style={{ width: 1, height: 1, overflow: 'hidden', zIndex: -1 }}
    >
      <GoogleMap
        mapContainerStyle={{ width: 1, height: 1 }}
        center={{ lat: 39.5, lng: -98.35 }}
        zoom={4}
        options={{
          disableDefaultUI: true,
          draggable: false,
          keyboardShortcuts: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
        }}
      />
    </div>
  );
}

export default function SettingsAddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  onClear,
  placeholder,
  isLoaded,
  icon,
  className = '',
  label,
  disabled = false,
}: SettingsAddressAutocompleteProps) {
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
  // a Retry button instead of silently closing.
  const [loadError, setLoadError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Watchdog: the Google callback can simply never fire (flaky network /
  // throttled key), which would leave the spinner spinning forever.
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic request id — responses from superseded requests are ignored.
  const requestSeqRef = useRef(0);
  // Last query actually sent to Google — powers the Retry button.
  const lastQueryRef = useRef('');
  const userLocation = useUserLocation();

  // Use refs for callbacks so re-renders don't stale-close over handlers
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);
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

  // Fetch predictions (US addresses)
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
    // Open immediately so the user sees the spinner while Google works.
    setShowDropdown(true);

    const request: google.maps.places.AutocompletionRequest = {
      input,
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
    };

    // Bias results toward the user's current GPS position (50 km radius).
    // new google.maps.LatLng (not a plain literal): the installed type defs
    // type AutocompletionRequest.location as LatLng whose lat/lng are
    // METHODS — a {lat, lng} literal is a type error here (the shared
    // component carries that pre-existing error; this file must add none).
    if (userLocation) {
      request.location = new google.maps.LatLng(userLocation.lat, userLocation.lng);
      request.radius = 50000;
    }

    // Watchdog: if Google's callback hasn't fired within 8s, surface an
    // explicit error row with Retry instead of an eternal spinner.
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
          } else {
            setLoadError(true);
          }
          setShowDropdown(true);
          return;
        }

        setPredictions(results);
        setLoadError(false);
        setShowDropdown(true);
      }
    );
  }, [userLocation, cancelPendingRequest, clearWatchdog]);

  const handleRetryPredictions = useCallback(() => {
    if (lastQueryRef.current.trim()) {
      fetchPredictions(lastQueryRef.current);
    }
  }, [fetchPredictions]);

  // Cleanup on unmount: debounce timer + watchdog + in-flight request bump
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

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  }, [fetchPredictions]);

  // Handle prediction selection → fetch details → let the parent pre-fill
  // city / state / country / postal code / coordinates from the place.
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
          return;
        }

        const formattedAddress = place.formatted_address || prediction.description;
        setInputValue(formattedAddress);
        onChangeRef.current(formattedAddress);
        onPlaceSelectRef.current(place);
      }
    );
  }, []);

  // Reopen on refocus when there is something worth showing: results,
  // or an error row (so Retry stays reachable after a tap elsewhere).
  const handleFocus = useCallback(() => {
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
