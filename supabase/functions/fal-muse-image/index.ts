// fal.ai Muse Image proxy: submit generation task + poll status.
// Used by the Ring recipe to turn a text prompt (+ optional reference image)
// into a 3D-printable product concept image.
//   - meta/muse-image/text-to-image → text-to-image (no reference)
//   - meta/muse-image/edit          → image editing (reference images required)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FAL_MODEL_TXT2IMG = 'meta/muse-image/text-to-image';
const FAL_MODEL_EDIT = 'meta/muse-image/edit';

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
interface StatusBody { action: 'status'; taskId: string; statusUrl?: string; responseUrl?: string; }

// Muse accepts aspect ratios directly; validate against its enum.
const ASPECT_RATIOS = new Set(['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21']);

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
      const hasImages = Array.isArray(body.imageUrls) && body.imageUrls.length > 0;
      if (hasImages) input.image_urls = body.imageUrls;
      // The edit model requires image_urls; use text-to-image without them.
      const model = hasImages ? FAL_MODEL_EDIT : FAL_MODEL_TXT2IMG;

      const res = await fetch(`https://queue.fal.run/${model}`, {
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
      // Use the exact polling URLs fal returns (queue routing can vary per endpoint).
      return new Response(JSON.stringify({
        taskId: data.request_id,
        statusUrl: data.status_url ?? null,
        responseUrl: data.response_url ?? null,
      }), {
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
      // Prefer the exact URLs fal returned at submit time; fall back to the
      // conventional queue paths (fal normalizes polling URLs to the
      // owner/model base). Only allow fal.run hosts (SSRF guard).
      const isFalUrl = (u: unknown): u is string =>
        typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)?fal\.run\//.test(u);
      const statusUrl = isFalUrl(body.statusUrl)
        ? body.statusUrl
        : `https://queue.fal.run/${FAL_MODEL_TXT2IMG}/requests/${id}/status`;
      const responseUrl = isFalUrl(body.responseUrl)
        ? body.responseUrl
        : `https://queue.fal.run/${FAL_MODEL_TXT2IMG}/requests/${id}`;

      const statusRes = await fetch(statusUrl, { headers: authHeaders });
      const statusData = await statusRes.json().catch(() => ({}));
      const falStatus: string = statusData?.status ?? 'UNKNOWN';
      console.log('fal status http', statusRes.status, JSON.stringify(statusData).slice(0, 2000));

      if (falStatus === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, { headers: authHeaders });
        const result = await resultRes.json().catch(() => ({}));
        console.log('fal result http', resultRes.status, JSON.stringify(result).slice(0, 2000));
        const imageUrl: string | null =
          result?.images?.[0]?.url ?? result?.image?.url ?? null;
        if (!imageUrl) {
          // fal marks validation/execution failures as COMPLETED with an
          // error payload — surface it as a failure with the details.
          return new Response(JSON.stringify({ state: 'fail', imageUrl: null, raw: result }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
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
