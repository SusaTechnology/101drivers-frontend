/**
 * Reusable image compression utility for delivery evidence photos.
 *
 * Uses browser-image-compression to resize and compress images
 * client-side before upload, reducing file size by ~80-90%
 * while maintaining compliance-grade quality.
 *
 * @example
 * ```ts
 * import { compressPhoto } from '@/lib/image-compress'
 *
 * const compressedFile = await compressPhoto(rawFile)
 * // or with custom options
 * const compressedFile = await compressPhoto(rawFile, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 })
 * ```
 */

import imageCompression from 'browser-image-compression'

export interface CompressOptions {
  /** Max width or height in pixels (maintains aspect ratio). Default: 1920 */
  maxWidthOrHeight?: number
  /** Max file size in MB. Default: 0.8 (800KB) */
  maxSizeMB?: number
  /** JPEG quality 0-1. Higher = better quality but larger file. Default: 0.8 */
  initialQuality?: number
  /** Output format. Default: 'image/jpeg' */
  fileType?: string
  /**
   * How aggressively to try to reach maxSizeMB.
   * More iterations = better compression but slower.
   * Default: 2 (fast, good enough)
   */
  maxIteration?: number
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidthOrHeight: 1920,
  maxSizeMB: 0.8,
  initialQuality: 0.8,
  fileType: 'image/jpeg',
  maxIteration: 2,
}

/**
 * Compress a single image file.
 * Returns a new File object with compressed data.
 *
 * - Resizes to max 1920px on the longer side (preserves aspect ratio)
 * - Compresses to JPEG at 80% quality
 * - Caps output at 800KB
 * - Skips files already under maxSizeMB (no double-compression)
 *
 * @param file - Raw image File from camera/input
 * @param options - Override default compression settings
 * @returns Compressed File (always JPEG)
 */
export async function compressPhoto(
  file: File,
  options?: CompressOptions,
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const maxSizeKB = opts.maxSizeMB * 1024

  // Skip if already small enough
  if (file.size <= maxSizeKB) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: opts.maxWidthOrHeight,
      maxSizeMB: opts.maxSizeMB,
      initialQuality: opts.initialQuality,
      fileType: opts.fileType,
      maxIteration: opts.maxIteration,
      // Keep EXIF data (GPS coordinates, timestamp) when possible
      exifOrientation: undefined, // let the library auto-handle orientation
      useWebWorker: true, // offload to web worker for UI responsiveness
    })

    // Build a proper File object with meaningful name
    const ext = opts.fileType === 'image/jpeg' ? 'jpg' : opts.fileType.split('/')[1]
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const compressedFile = new File(
      [compressed],
      `${baseName}_compressed.${ext}`,
      { type: opts.fileType, lastModified: Date.now() },
    )

    return compressedFile
  } catch (error) {
    // Fallback: return original if compression fails (better to upload large than not at all)
    console.warn('[image-compress] Compression failed, using original:', error)
    return file
  }
}

/**
 * Compress multiple image files in parallel.
 * Useful for batch uploads (e.g., 6 vehicle photos).
 *
 * @param files - Array of raw image Files
 * @param options - Override default compression settings
 * @returns Array of compressed Files (same order as input)
 */
export async function compressPhotos(
  files: File[],
  options?: CompressOptions,
): Promise<File[]> {
  return Promise.all(files.map((file) => compressPhoto(file, options)))
}

/**
 * Build a FormData payload with compressed photos.
 * Handles both single and batch uploads.
 *
 * @param files - Raw or pre-compressed image Files
 * @param deliveryId - Delivery ID to attach
 * @param phase - 'PICKUP' or 'DROPOFF'
 * @param options - Compression options (applied if files are raw)
 * @returns FormData ready for upload
 */
export async function buildCompressedUploadPayload(
  files: File[],
  deliveryId: string,
  phase: 'PICKUP' | 'DROPOFF',
  options?: CompressOptions,
): Promise<FormData> {
  const compressed = await compressPhotos(files, options)
  const formData = new FormData()

  compressed.forEach((file) => {
    formData.append('files', file)
  })

  formData.append('deliveryId', deliveryId)
  formData.append('phase', phase)

  return formData
}
