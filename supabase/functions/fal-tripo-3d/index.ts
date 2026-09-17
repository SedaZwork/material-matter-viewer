// fal.ai Tripo H3.1 image-to-3D proxy: submit task + poll status.
// Unifies the ring recipe on fal.ai (same provider as Muse Image concepts).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FAL_MODEL = 'tripo3d/h3.1/image-to-3d';

interface CreateBody {
  action: 'create';
  imageUrl: string;
  pbr?: boolean;
  texture?: boolean;
  orientation?: 'default' | 'align_image';
  textureQuality?: 'standard' | 'detailed';
  geometryQuality?: 'standard' | 'detailed';
  textureAlignment?: 'original_image' | 'geometry';
  faceLimit?: number;
  autoSize?: boolean;
}
interface StatusBody { action: 'status'; taskId: string; statusUrl?: string; responseUrl?: string }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const FAL_KEY = Deno.env.get('FAL_KEY');
  if (!FAL_KEY) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const authHeaders = { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' };

  try {
    const body = (await req.json()) as CreateBody | StatusBody;

    if (body.action === 'create') {
      if (!body.imageUrl || typeof body.imageUrl !== 'string' || !/^https?:\/\//.test(body.imageUrl)) {
        return new Response(JSON.stringify({ error: 'Invalid imageUrl' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const input = {
        pbr: body.pbr ?? false,
        texture: body.texture ?? false,
        image_url: { path: body.imageUrl, relativePath: body.imageUrl },
        orientation: oneOf(body.orientation, ['default', 'align_image'] as const, 'default'),
        texture_quality: oneOf(body.textureQuality, ['standard', 'detailed'] as const, 'standard'),
        geometry_quality: oneOf(body.geometryQuality, ['standard', 'detailed'] as const, 'standard'),
        texture_alignment: oneOf(body.textureAlignment, ['original_image', 'geometry'] as const, 'original_image'),
        face_limit: clamp(Math.round(body.faceLimit ?? 2_000_000), 1000, 2_000_000),
        auto_size: body.autoSize ?? true,
      };

      const res = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.request_id) {
        return new Response(JSON.stringify({ error: 'fal.ai submit failed', details: data }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        taskId: data.request_id,
        statusUrl: data.status_url ?? null,
        responseUrl: data.response_url ?? null,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (body.action === 'status') {
      if (!body.taskId) {
        return new Response(JSON.stringify({ error: 'Missing taskId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const id = encodeURIComponent(body.taskId);
      const isFalUrl = (u: unknown): u is string =>
        typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)?fal\.run\//.test(u);
      const statusUrl = isFalUrl(body.statusUrl)
        ? body.statusUrl
        : `https://queue.fal.run/${FAL_MODEL}/requests/${id}/status`;
      const responseUrl = isFalUrl(body.responseUrl)
        ? body.responseUrl
        : `https://queue.fal.run/${FAL_MODEL}/requests/${id}`;

      const statusRes = await fetch(statusUrl, { headers: authHeaders });
      const statusData = await statusRes.json().catch(() => ({}));
      const falStatus: string = statusData?.status ?? 'UNKNOWN';
      console.log('tripo status http', statusRes.status, JSON.stringify(statusData).slice(0, 1000));

      if (falStatus === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, { headers: authHeaders });
        const result = await resultRes.json().catch(() => ({}));
        console.log('tripo result http', resultRes.status, JSON.stringify(result).slice(0, 2000));
        const modelUrl: string | null =
          result?.model_mesh?.url ??
          result?.pbr_model?.url ??
          result?.model_glb?.url ??
          result?.model?.url ??
          null;
        if (!modelUrl) {
          return new Response(JSON.stringify({ state: 'fail', modelUrl: null, raw: result }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          state: 'completed',
          modelUrl,
          previewUrl: result?.rendered_image?.url ?? null,
          raw: result,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
        return new Response(JSON.stringify({ state: 'processing', modelUrl: null }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ state: 'fail', modelUrl: null, raw: statusData }), {
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
