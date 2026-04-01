/**
 * Cloudinary Public ID Utilities
 * 
 * Handles normalization of storage keys to valid Cloudinary public_ids
 * - Extracts public_id from URLs
 * Removes version prefixes (v123/)
 * Strips file extensions (.mp3, .mp4, .webp, etc.)
 */

/**
 * Normalizes a storage key to a valid Cloudinary public_id
 * 
 * @param input - Raw storage key (can be URL, public_id with extension, etc.)
 * @returns Clean public_id without extension or version
 * @throws Error if input is invalid or cannot be normalized
 */
export function normalizePublicId(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid storage key: empty or not a string');
  }

  let publicId = input.trim();

  // If URL → extract path after /upload/
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    const uploadMatch = publicId.match(
      /\/(?:upload|authenticated)\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.[^/.?]+)?(?:\?.*)?$/
    );
    if (uploadMatch && uploadMatch[1]) {
      publicId = uploadMatch[1];
    } else {
      // Try alternative pattern for direct URLs
      const parts = publicId.split('/');
      if (parts.length >= 2) {
        publicId = parts[parts.length - 1];
      } else {
        throw new Error(`Invalid Cloudinary URL: ${input.substring(0, 50)}...`);
      }
    }
  }

  // Remove version prefix if exists (v123/)
  publicId = publicId.replace(/^v\d+\//, '');

  // CRITICAL: Remove file extension (.mp3, .mp4, .webp, .jpg, etc.)
  // Cloudinary public_id must NOT include extension
  publicId = publicId.replace(/\.[^/.]+$/, '');

  if (!publicId) {
    throw new Error('Invalid public_id: empty after normalization');
  }

  return publicId;
}

/**
 * Validates if a string is a valid Cloudinary public_id
 * - Must not start with http
 * - Must not contain file extension
 * - Must not be empty
 */
export function isValidPublicId(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  // Check for file extension
  if (/\.[^/.]+$/.test(value)) return false;
  return value.length > 0;
}

/**
 * Extracts public_id from a Cloudinary URL
 * @param url - Full Cloudinary URL
 * @returns public_id or null if extraction fails
 */
export function extractPublicIdFromUrl(url: string): string | null {
  if (!url || !url.startsWith('http')) return null;
  
  // Pattern: https://res.cloudinary.com/{cloud}/(image|video)/upload/(v{version}/)?{public_id}.{ext}
  // Also supports authenticated delivery URLs:
  // https://res.cloudinary.com/{cloud}/video/authenticated/s--sig--/v1/{public_id}.mp3
  const match = url.match(
    /\/(?:upload|authenticated)\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.[^/.?]+)?(?:\?.*)?$/
  );
  if (match && match[1]) {
    // Remove extension from extracted public_id
    return match[1].replace(/\.[^/.]+$/, '');
  }
  return null;
}

/**
 * Logs normalization details for debugging
 */
export function logPublicIdNormalization(
  original: string, 
  normalized: string, 
  context: string
): void {
  const hasExtension = /\.[^/.]+$/.test(original);
  const wasUrl = original.startsWith('http');
  
  console.log(`[${context}] Public ID normalization:`, {
    original: original.substring(0, 60),
    normalized: normalized.substring(0, 60),
    wasUrl,
    hadExtension: hasExtension,
    changed: original !== normalized
  });
}
