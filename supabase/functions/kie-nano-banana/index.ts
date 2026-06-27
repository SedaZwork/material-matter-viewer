// Kie.ai Nano Banana proxy: create image generation task + query status.
// Used by the Ring recipe to turn a text prompt (+ optional reference image)
// into a 3D-printed-product concept image.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const KIE_BASE = 'https://api.kie.ai/api/v1';

interface CreateBody {
  action: 'create';
  prompt: string;
  imageUrls?: string[]; // for nano-banana-edit
  outputFormat?: 'png' | 'jpeg';
  imageSize?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
  recipe?: 'ring' | string;
}

// Ring recipe system prompt — enforces a single, closed, 3D-printable ring body
// suitable for image-to-3D reconstruction (Trellis) downstream.
const RING_SYSTEM_PROMPT = [
  'Generate a professional product concept image of a SINGLE finger ring.',
  'Hard requirements (must all be satisfied):',
  '- Exactly ONE ring as a single connected solid body, closed watertight surfaces, manifold geometry, no separate floating parts, no chains, no gemstones detached from the band, no text, no logos.',
  '- Continuous closed circular band with a clearly visible inner hole (finger opening). No open/cut shanks.',
  '- Wall thickness everywhere visibly printable (no paper-thin edges, no hair-thin filigree, no overhangs that would not be reconstructable from a single view).',
  '- Opaque, matte or lightly satin material so geometry is unambiguous — avoid transparent glass, refractive gems, mirror chrome, fur, cloth, liquid, or particles.',
  '- Centered, isolated on a clean seamless pure white studio background, soft even product lighting, no hands, no models, no props, no shadows on background, no reflections of environment.',
  '- 3/4 hero product view showing the band silhouette and the inner hole. Whole ring fully inside the frame with a small margin. Square composition.',
  '- Photoreal product photography style, sharp focus across the entire ring, no depth-of-field blur, no motion blur, no bokeh, no post-processing artifacts.',
  'The image will be fed directly into an image-to-3D reconstructor, so the silhouette and surfaces must be unambiguous.',
  'User concept to interpret within the constraints above:',
].join('\n');

const SYSTEM_PROMPTS: Record<string, string> = {
  ring: RING_SYSTEM_PROMPT,
};
interface StatusBody { action: 'status'; taskId: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const KIE_API_KEY = Deno.env.get('KIE_API_KEY');
  if (!KIE_API_KEY) {
    return new Response(JSON.stringify({ error: 'KIE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as CreateBody | StatusBody;

    if (body.action === 'create') {
      if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.length > 2000) {
        return new Response(JSON.stringify({ error: 'Invalid prompt' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Pick edit model when reference images are present, otherwise text-to-image.
      const hasImages = Array.isArray(body.imageUrls) && body.imageUrls.length > 0;
      const model = hasImages ? 'google/nano-banana-edit' : 'google/nano-banana';
      const input: Record<string, unknown> = {
        prompt: body.prompt,
        output_format: body.outputFormat ?? 'png',
        image_size: body.imageSize ?? '1:1',
      };
      if (hasImages) input.image_urls = body.imageUrls;

      const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, input }),
      });
      const data = await res.json();
      if (!res.ok || data.code !== 200) {
        return new Response(JSON.stringify({ error: 'Kie createTask failed', details: data }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ taskId: data.data.taskId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'status') {
      if (!body.taskId) {
        return new Response(JSON.stringify({ error: 'Missing taskId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(body.taskId)}`, {
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
      });
      const data = await res.json();
      // Normalize: state = 'waiting' | 'success' | 'fail', resultJson holds output urls
      let imageUrl: string | null = null;
      const rj = data?.data?.resultJson;
      if (rj) {
        try {
          const parsed = typeof rj === 'string' ? JSON.parse(rj) : rj;
          imageUrl = parsed?.resultUrls?.[0] ?? parsed?.images?.[0] ?? parsed?.image_url ?? null;
        } catch { /* ignore */ }
      }
      return new Response(JSON.stringify({
        state: data?.data?.state ?? 'unknown',
        imageUrl,
        raw: data?.data,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
