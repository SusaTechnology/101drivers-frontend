import { useState, useEffect } from 'react'

export interface UserLocation {
  lat: number
  lng: number
}

/**
 * One-shot GPS hook — requests the user's position once on mount
 * and returns it for the lifetime of the component.
 *
 * Silently returns null if the user denies permission or the
 * browser has no geolocation support (e.g. desktop without GPS).
 */
export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!cancelled) {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        }
      },
      () => {
        // Denied or unavailable — stay null, no toast needed
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000, // 5 min cache — avoids repeated prompts
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return location
}
