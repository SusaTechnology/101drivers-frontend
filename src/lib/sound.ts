/**
 * Production-ready notification sound module.
 *
 * Handles:
 *   1. Single preloaded Audio instance (no per-notification HTTP request).
 *   2. AudioContext fallback for strict mobile browsers where Audio.play() fails.
 *   3. User-gesture audio unlock (plays at very low volume, not silent — some
 *      iOS versions reject volume=0 as "not a real user gesture").
 *   4. Sound preference from localStorage with cross-tab sync via storage event.
 *
 * Used by:
 *   - driver.tsx               → calls unlockAudio() on first user interaction
 *   - driver-feed-tracker.ts  → calls playNotificationSound() on new gig
 */

// ── Constants ──────────────────────────────────────────────────────────────
const SOUND_URL = '/assets/notification.mp3'
const STORAGE_KEY = 'driverSoundEnabled'

// ── Module-level state ─────────────────────────────────────────────────────
let preloadedAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let audioBufferLoaded = false
let audioContextFailed = false
let soundEnabled = localStorage.getItem(STORAGE_KEY) !== 'false' // default ON

// ── Preference management ──────────────────────────────────────────────────

/**
 * Check whether the notification sound is currently enabled.
 */
export function isSoundEnabled(): boolean {
  return soundEnabled
}

/**
 * Cross-tab sync: listen for localStorage changes so if the driver toggles
 * sound in another tab (or the preferences page in the same tab), this
 * module stays in sync without a page refresh.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      soundEnabled = e.newValue !== 'false'
    }
  })
}

// ── Audio preload ──────────────────────────────────────────────────────────

/**
 * Preload the notification sound as an HTMLAudioElement.
 * Called once during app init — no per-notification network requests.
 */
function ensurePreloaded(): HTMLAudioElement {
  if (!preloadedAudio) {
    const audio = new Audio(SOUND_URL)
    audio.preload = 'auto'
    // Don't call load() here — let the browser handle it on first play
    preloadedAudio = audio
  }
  return preloadedAudio
}

/**
 * Attempt to decode the MP3 into an AudioBuffer for AudioContext playback.
 * This is the fallback when Audio.play() is blocked.
 * Runs once; if it fails, we skip AudioContext entirely.
 */
function ensureAudioBuffer(): void {
  if (audioBufferLoaded || audioContextFailed) return

  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContext = ctx

    fetch(SOUND_URL)
      .then((res) => res.arrayBuffer())
      .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
      .then((buf) => {
        audioBuffer = buf
        audioBufferLoaded = true
      })
      .catch(() => {
        // Fetch or decode failed — AudioContext fallback not available
        audioContextFailed = true
      })
  } catch {
    // AudioContext not supported at all
    audioContextFailed = true
  }
}

// ── Playback via AudioContext fallback ────────────────────────────────────

function playViaAudioContext(): boolean {
  if (!audioContext || !audioBuffer) return false

  try {
    // Resume if suspended (browsers auto-suspend unused contexts)
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer

    const gain = audioContext.createGain()
    gain.gain.value = 1.0
    source.connect(gain)
    gain.connect(audioContext.destination)

    source.onended = () => {
      source.disconnect()
      gain.disconnect()
    }

    source.start(0)
    return true
  } catch {
    return false
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Unlock browser audio on first user interaction (click or touch).
 *
 * IMPORTANT: We play at volume 0.01 (nearly inaudible) instead of 0.
 * Some iOS Safari versions reject volume=0 as "not a genuine user gesture"
 * and keep the audio lock. A tiny but non-zero volume satisfies the check.
 *
 * Call this from a useEffect in your root layout with click/touchstart listeners.
 */
export function unlockAudio(): void {
  const doUnlock = () => {
    // Unlock HTMLAudioElement
    try {
      const audio = ensurePreloaded()
      audio.volume = 0.01
      audio.play().then(() => {
        // Successfully unlocked — stop immediately
        audio.pause()
        audio.currentTime = 0
        audio.volume = 1.0 // restore for real notifications
      }).catch(() => {
        // Audio.play() blocked — AudioContext fallback will handle it
      })
    } catch {
      // ignore
    }

    // Start preloading AudioContext buffer in background
    ensureAudioBuffer()
  }

  // Attach to first user interaction
  document.addEventListener('click', doUnlock, { once: true })
  document.addEventListener('touchstart', doUnlock, { once: true })
}

/**
 * Play the notification sound.
 *
 * Strategy:
 *   1. Check preference — if sound disabled, return immediately.
 *   2. Try preloaded Audio.play() — works on most browsers.
 *   3. If that fails, fall back to AudioContext buffer playback.
 *   4. If both fail, silently give up (the unlock handler already prepped both).
 */
export function playNotificationSound(): void {
  if (!soundEnabled) return

  const audio = ensurePreloaded()

  // Strategy 1: HTMLAudioElement
  audio.currentTime = 0
  const playPromise = audio.play()

  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        // Success — sound is playing
      })
      .catch(() => {
        // Audio.play() blocked — try AudioContext fallback
        if (!playViaAudioContext()) {
          console.warn('[Sound] Could not play notification — browser blocked audio')
        }
      })
  } else {
    // No promise returned (old browser) — try AudioContext as fallback
    if (!playViaAudioContext()) {
      console.warn('[Sound] Could not play notification — no play() promise')
    }
  }
}
