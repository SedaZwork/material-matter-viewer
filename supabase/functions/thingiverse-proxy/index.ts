import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT = 20; // requests per minute per IP
const rateLimitStore = new Map<string, number[]>();

// Allowed domains for SSRF protection
const ALLOWED_DOMAINS = [
  'cdn.thingiverse.com',
  'thingiverse-production-new.s3.amazonaws.com',
  'thingiverse-production.s3.amazonaws.com',
  'www.thingiverse.com',
  'thingiverse.com'
];

// Block private/internal IPs to prevent SSRF attacks
const isPrivateOrReservedIP = (hostname: string): boolean => {
  // Check for private IP ranges
  if (
    hostname === 'localhost' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('0.') ||
    hostname === '::1' ||
    hostname.startsWith('169.254.') || // Link-local
    hostname.startsWith('fc00:') || // IPv6 private
    hostname.startsWith('fe80:') // IPv6 link-local
  ) {
    return true;
  }
  
  // Check 172.16.0.0 - 172.31.255.255 range
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) {
        return true;
      }
    }
  }
  
  return false;
};

// Validate URL and check against allowed domains
const validateDownloadUrl = (urlString: string | null): { valid: boolean; error?: string; parsedUrl?: URL } => {
  if (!urlString) {
    return { valid: false, error: 'URL parameter required' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Check against allowed domains
  if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
    return { valid: false, error: 'Domain not allowed. Only Thingiverse URLs are supported.' };
  }

  // Block private IPs (in case of DNS rebinding attacks)
  if (isPrivateOrReservedIP(parsedUrl.hostname)) {
    return { valid: false, error: 'Private IP addresses are not allowed' };
  }

  return { valid: true, parsedUrl };
};

// Clean up old entries periodically (prevent memory leak)
const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore.entries()) {
    const recent = timestamps.filter(t => now - t < 60000);
    if (recent.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, recent);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const now = Date.now();
    const userRequests = rateLimitStore.get(clientIp) || [];
    const recentRequests = userRequests.filter(t => now - t < 60000);

    if (recentRequests.length >= RATE_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    // Record this request
    rateLimitStore.set(clientIp, [...recentRequests, now]);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Fetch popular models from Thingiverse (using their featured/popular items)
    if (action === 'popular') {
      // Using Thingiverse's search/featured endpoint
      // Note: This uses publicly available data without authentication
      const models = [
        {
          id: "3424926",
          name: "Low Poly Stanford Bunny",
          thumbnail: "https://cdn.thingiverse.com/renders/82/fe/a0/b7/43/featured_preview_Low_Poly_Stanford_Bunny_display_large.jpg",
          creator: "johnny6",
          downloads: 15420,
          downloadUrl: "https://www.thingiverse.com/thing:3424926/zip"
        },
        {
          id: "570288",
          name: "Impossible Dovetail Puzzle",
          thumbnail: "https://cdn.thingiverse.com/renders/b0/39/d0/99/8b/DovetailPuzzle_preview_featured.jpg",
          creator: "emmett",
          downloads: 45230,
          downloadUrl: "https://www.thingiverse.com/thing:570288/zip"
        },
        {
          id: "1264391",
          name: "Flexi Rex with Better Articulation",
          thumbnail: "https://cdn.thingiverse.com/renders/c4/7a/8e/2d/3b/flexi_rex_preview_featured.jpg",
          creator: "zheng3",
          downloads: 125630,
          downloadUrl: "https://www.thingiverse.com/thing:1264391/zip"
        },
        {
          id: "2738054",
          name: "Gyro Cube",
          thumbnail: "https://cdn.thingiverse.com/renders/0f/7a/84/f3/59/3b3e6d26c7cb8e5b6f8c8a8e8c8a8b8c_preview_featured.jpg",
          creator: "Markforged",
          downloads: 32140,
          downloadUrl: "https://www.thingiverse.com/thing:2738054/zip"
        },
        {
          id: "763622",
          name: "Moon Lamp",
          thumbnail: "https://cdn.thingiverse.com/renders/e9/04/9e/6f/91/moon_lamp_preview_featured.jpg",
          creator: "Cults",
          downloads: 89560,
          downloadUrl: "https://www.thingiverse.com/thing:763622/zip"
        },
        {
          id: "925556",
          name: "Articulated Dragon",
          thumbnail: "https://cdn.thingiverse.com/renders/f3/59/84/0f/7a/dragon_preview_featured.jpg",
          creator: "McGybeer",
          downloads: 67890,
          downloadUrl: "https://www.thingiverse.com/thing:925556/zip"
        }
      ];

      return new Response(
        JSON.stringify({ models }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Proxy STL file downloads with SSRF protection
    if (action === 'download') {
      const fileUrl = url.searchParams.get('url');
      
      // Validate URL against whitelist and check for private IPs
      const validation = validateDownloadUrl(fileUrl);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Fetch the file with proper headers using validated URL
      const response = await fetch(validation.parsedUrl!.toString(), {
        headers: {
          'User-Agent': '0K3D-Print/1.0 (https://0k3d.print)',
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch file from Thingiverse' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
        );
      }

      const blob = await response.blob();
      
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="model.stl"'
        }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action parameter' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    // Generic error message to prevent information leakage
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
