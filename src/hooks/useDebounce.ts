// Debounce hook for filter inputs
import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook that returns a debounced value after the specified delay
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook that provides debounced callback functionality
 * Useful for search inputs where you want to delay the actual search
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Hook for managing filter state with debounce
 * Returns the immediate value (for input) and debounced value (for API calls)
 */
export function useDebouncedFilter<T>(
  initialValue: T,
  delay: number = 300
): {
  value: T
  debouncedValue: T
  setValue: (value: T) => void
  setValueImmediate: (value: T) => void
} {
  const [value, setValue] = useState<T>(initialValue)
  const debouncedValue = useDebouncedValue(value, delay)

  // Immediate setter that bypasses debounce
  const setValueImmediate = useCallback((newValue: T) => {
    setValue(newValue)
  }, [])

  return { value, debouncedValue, setValue, setValueImmediate }
}
