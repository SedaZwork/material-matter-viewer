import { logger } from './logger';

/**
 * Validates geocoding input to prevent API abuse and injection attacks
 * @param input - The address or postal code to validate
 * @returns true if the input is valid, false otherwise
 */
export const validateGeocodingInput = (input: string): boolean => {
  // Check for null/undefined/empty
  if (!input || typeof input !== 'string') return false;
  
  const trimmed = input.trim();
  
  // Max length check (100 characters is more than enough for any address)
  if (trimmed.length > 100) return false;
  
  // Min length check
  if (trimmed.length < 1) return false;
  
  // Allow only alphanumeric characters, spaces, commas, hyphens, periods, apostrophes
  // This covers most international address formats while blocking special characters
  const validPattern = /^[a-zA-Z0-9\s,.\-'À-ÿ]+$/;
  if (!validPattern.test(trimmed)) return false;
  
  return true;
};

/**
 * Sanitizes and normalizes geocoding input
 * @param input - The address or postal code to sanitize
 * @returns The sanitized address string
 */
export const sanitizeGeocodingInput = (input: string): string => {
  return input
    .trim()
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .substring(0, 100);     // Enforce max length
};

/**
 * Rate limiting for geocoding requests
 */
const geocodingRateLimit = {
  lastRequest: 0,
  minInterval: 1000, // 1 second between requests (Nominatim ToS)
};

/**
 * Geocodes an address using the OpenStreetMap Nominatim API
 * Includes input validation, rate limiting, and proper error handling
 * @param address - The address to geocode
 * @returns The coordinates or null if not found
 */
export const geocodeAddress = async (
  address: string
): Promise<{ lat: number; lng: number } | null> => {
  // Validate input
  if (!validateGeocodingInput(address)) {
    logger.warn('Invalid geocoding input rejected', { address: address.substring(0, 50) });
    return null;
  }
  
  // Sanitize input
  const cleanAddress = sanitizeGeocodingInput(address);
  
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - geocodingRateLimit.lastRequest;
  if (timeSinceLastRequest < geocodingRateLimit.minInterval) {
    await new Promise(resolve => 
      setTimeout(resolve, geocodingRateLimit.minInterval - timeSinceLastRequest)
    );
  }
  geocodingRateLimit.lastRequest = Date.now();
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': '0K3D-Print/1.0 (contact@0k3d.print)', // Required by Nominatim ToS
        },
      }
    );
    
    if (!response.ok) {
      logger.warn('Geocoding API returned non-OK status', { status: response.status });
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Geocoding request failed', error);
    return null;
  }
};
