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
}
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
