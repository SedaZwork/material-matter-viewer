// PiAPI Trellis image-to-3D proxy: create task + poll until GLB is ready.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PIAPI_BASE = 'https://api.piapi.ai/api/v1';

interface CreateBody {
  action: 'create';
  imageUrl: string;
  seed?: number;
  ssSamplingSteps?: number;       // 1-50, default 50 (max detail)
  slatSamplingSteps?: number;     // 1-50, default 50 (max detail)
  ssGuidanceStrength?: number;    // sparse-structure guidance, default 7.5
  slatGuidanceStrength?: number;  // texture/latent guidance, default 3
}
interface StatusBody { action: 'status'; taskId: string; }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const PIAPI_KEY = Deno.env.get('PIAPI_KEY');
  if (!PIAPI_KEY) {
    return new Response(JSON.stringify({ error: 'PIAPI_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as CreateBody | StatusBody;

    if (body.action === 'create') {
      if (!body.imageUrl || typeof body.imageUrl !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid imageUrl' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const payload = {
        model: 'Qubico/trellis',
        task_type: 'image-to-3d',
        input: {
          image: body.imageUrl,
          // Max-quality defaults — overridable from the client.
          ss_sampling_steps: clamp(body.ssSamplingSteps ?? 50, 1, 50),
          slat_sampling_steps: clamp(body.slatSamplingSteps ?? 50, 1, 50),
          ss_guidance_strength: clamp(body.ssGuidanceStrength ?? 9.5, 0, 15),
          slat_guidance_strength: clamp(body.slatGuidanceStrength ?? 5, 0, 15),
          seed: body.seed ?? 0,
        },
      };
      const res = await fetch(`${PIAPI_BASE}/task`, {
        method: 'POST',
        headers: { 'x-api-key': PIAPI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.code !== 200) {
        return new Response(JSON.stringify({ error: 'PiAPI createTask failed', details: data }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ taskId: data.data.task_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'status') {
      if (!body.taskId) {
        return new Response(JSON.stringify({ error: 'Missing taskId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const res = await fetch(`${PIAPI_BASE}/task/${encodeURIComponent(body.taskId)}`, {
        headers: { 'x-api-key': PIAPI_KEY },
      });
      const data = await res.json();
      const task = data?.data ?? {};
      // PiAPI status values: pending, processing, completed, failed
      const output = task.output ?? {};
      const modelUrl =
        output.model_file ??
        output.glb_url ??
        output.model_url ??
        output.no_background_model_url ??
        null;
      return new Response(JSON.stringify({
        state: task.status ?? 'unknown',
        modelUrl,
        previewUrl: output.rendered_image ?? output.preview_url ?? null,
        raw: task,
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
