// fal.ai Muse Image proxy: submit generation task + poll status.
// Used by the Ring recipe to turn a text prompt (+ optional reference image)
// into a 3D-printable product concept image via meta/muse-image/edit.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FAL_MODEL = 'meta/muse-image/edit';
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_MODEL}`;

interface CreateBody {
  action: 'create';
  prompt: string;
  imageUrls?: string[]; // reference images for the edit model
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

// Map aspect ratios to fal's image_size presets (square_hd ≈ 1024x1024).
const SIZE_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '3:4': 'portrait_4_3',
  '4:3': 'landscape_4_3',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const FAL_KEY = Deno.env.get('FAL_KEY');
  if (!FAL_KEY) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeaders = {
    'Authorization': `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const body = (await req.json()) as CreateBody | StatusBody;

    if (body.action === 'create') {
      if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.length > 2000) {
        return new Response(JSON.stringify({ error: 'Invalid prompt' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const sys = body.recipe ? SYSTEM_PROMPTS[body.recipe] : undefined;
      const finalPrompt = sys ? `${sys}\n"""${body.prompt.trim()}"""` : body.prompt;

      const input: Record<string, unknown> = {
        prompt: finalPrompt,
        num_images: 1,
        output_format: body.outputFormat ?? 'png',
        image_size: SIZE_MAP[body.imageSize ?? '1:1'] ?? 'square_hd',
      };
      if (Array.isArray(body.imageUrls) && body.imageUrls.length > 0) {
        input.image_urls = body.imageUrls;
      }

      const res = await fetch(FAL_QUEUE_BASE, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.request_id) {
        return new Response(JSON.stringify({ error: 'fal.ai submit failed', details: data }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ taskId: data.request_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'status') {
      if (!body.taskId) {
        return new Response(JSON.stringify({ error: 'Missing taskId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const id = encodeURIComponent(body.taskId);
      const statusRes = await fetch(`${FAL_QUEUE_BASE}/requests/${id}/status`, {
        headers: authHeaders,
      });
      const statusData = await statusRes.json().catch(() => ({}));
      const falStatus: string = statusData?.status ?? 'UNKNOWN';
      console.log('fal status http', statusRes.status, JSON.stringify(statusData).slice(0, 2000));

      if (falStatus === 'COMPLETED') {
        const resultRes = await fetch(`${FAL_QUEUE_BASE}/requests/${id}`, {
          headers: authHeaders,
        });
        const result = await resultRes.json().catch(() => ({}));
        console.log('fal result http', resultRes.status, JSON.stringify(result).slice(0, 2000));
        const imageUrl: string | null =
          result?.images?.[0]?.url ?? result?.image?.url ?? null;
        return new Response(JSON.stringify({
          state: 'success',
          imageUrl,
          raw: result,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
        return new Response(JSON.stringify({ state: 'waiting', imageUrl: null }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ state: 'fail', imageUrl: null, raw: statusData }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
