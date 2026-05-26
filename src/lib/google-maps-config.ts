/**
 * Shared Google Maps configuration
 * 
 * IMPORTANT: The libraries array must be defined outside of components
 * to prevent unnecessary re-renders and the "LoadScript has been reloaded 
 * unintentionally" warning.
 * 
 * See: https://react-google-maps-api-docs.netlify.app/#loadscript-is-reloaded-unintentionally
 */

import type { Libraries } from '@react-google-maps/api'

// Define libraries once at module level
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['geometry', 'places', 'drawing']

// Google Maps script ID for consistent loading
export const GOOGLE_MAPS_SCRIPT_ID = 'google-map-script'
