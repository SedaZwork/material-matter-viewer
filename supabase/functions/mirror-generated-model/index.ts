// Mirrors an externally-generated asset (concept image or .glb model) into the
// project's `0K3D_Modelos_Generados` Supabase Storage bucket, under the
// signed-in user's own folder, named by ref code.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const BUCKET = '0K3D_Modelos_Generados';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sourceUrl, refCode, kind = 'model' } = await req.json();
    if (typeof sourceUrl !== 'string' || !/^https?:\/\//i.test(sourceUrl)) {
      return json({ error: 'Invalid sourceUrl' }, 400);
    }
    if (typeof refCode !== 'string' || !/^0K3D-[A-Z0-9]{6,12}$/.test(refCode)) {
      return json({ error: 'Invalid refCode' }, 400);
    }
    if (kind !== 'model' && kind !== 'concept_image') {
      return json({ error: 'Invalid kind' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Resolve the caller so assets land in their own folder (RLS-readable).
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await anon.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    const res = await fetch(sourceUrl);
    if (!res.ok) return json({ error: `Source fetch failed (${res.status})` }, 502);
    const blob = await res.arrayBuffer();

    const isModel = kind === 'model';
    const remoteType = res.headers.get('content-type') ?? '';
    const contentType = isModel
      ? 'model/gltf-binary'
      : remoteType.startsWith('image/')
        ? remoteType
        : 'image/png';
    const ext = isModel ? 'glb' : (contentType.split('/')[1] || 'png').split(';')[0];
    const folder = isModel ? 'models' : 'concepts';
    const path = userId
      ? `${folder}/${userId}/${refCode}.${ext}`
      : `${folder}/${refCode}.${ext}`;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (upErr) return json({ error: 'Upload failed', details: upErr.message }, 500);

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24); // 24h
    if (signErr) return json({ error: 'Signing failed', details: signErr.message }, 500);

    return json({ path, signedUrl: signed.signedUrl, bucket: BUCKET, refCode, kind });
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
