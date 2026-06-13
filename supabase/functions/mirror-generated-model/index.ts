// Mirrors an externally-generated 3D model (.glb) into the project's
// `0K3D_Modelos_Generados` Supabase Storage bucket, naming it by ref code.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const BUCKET = '0K3D_Modelos_Generados';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sourceUrl, refCode } = await req.json();
    if (typeof sourceUrl !== 'string' || !/^https?:\/\//i.test(sourceUrl)) {
      return json({ error: 'Invalid sourceUrl' }, 400);
    }
    if (typeof refCode !== 'string' || !/^0K3D-[A-Z0-9]{6,12}$/.test(refCode)) {
      return json({ error: 'Invalid refCode' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const res = await fetch(sourceUrl);
    if (!res.ok) return json({ error: `Source fetch failed (${res.status})` }, 502);
    const blob = await res.arrayBuffer();
    const path = `models/${refCode}.glb`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'model/gltf-binary',
      upsert: true,
    });
    if (upErr) return json({ error: 'Upload failed', details: upErr.message }, 500);

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24); // 24h
    if (signErr) return json({ error: 'Signing failed', details: signErr.message }, 500);

    return json({ path, signedUrl: signed.signedUrl, bucket: BUCKET, refCode });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
