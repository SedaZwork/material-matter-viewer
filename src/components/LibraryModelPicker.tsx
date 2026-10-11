import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, STLLoader } from 'three-stdlib';
import { Library, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LibraryModel { id: string; name: string; geometry: THREE.BufferGeometry }
interface Row { id: string; ref_code: string; recipe: string; storage_path: string | null; source_url: string | null }

/** Parse a GLB/STL into one geometry, sized to `targetMm` on its longest side (preview units are mm). */
async function loadGeometry(url: string, path: string, targetMm = 60) {
  const buffer = await (await fetch(url)).arrayBuffer();
  let geometry: THREE.BufferGeometry;
  if (/\.stl$/i.test(path)) geometry = new STLLoader().parse(buffer);
  else {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    let best: THREE.Mesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (!best || mesh.geometry.attributes.position.count > best.geometry.attributes.position.count)) best = mesh;
    });
    if (!best) throw new Error('No mesh');
    const picked = best as THREE.Mesh;
    geometry = picked.geometry.clone().applyMatrix4(picked.matrixWorld);
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  geometry.scale(targetMm / max, targetMm / max, targetMm / max);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  return geometry;
}

export default function LibraryModelPicker({ onAdd, className }: { onAdd: (model: LibraryModel) => void; className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user || rows) return;
    void supabase.from('generated_assets').select('id, ref_code, recipe, storage_path, source_url')
      .eq('user_id', user.id).eq('kind', 'model').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [open, user, rows]);

  const pick = async (row: Row) => {
    setLoading(row.id); setError('');
    try {
      let url = row.source_url;
      if (row.storage_path) {
        const { data } = await supabase.storage.from('0K3D_Modelos_Generados').createSignedUrl(row.storage_path, 600);
        url = data?.signedUrl ?? url;
      }
      if (!url) throw new Error('No file');
      onAdd({ id: row.id, name: row.ref_code, geometry: await loadGeometry(url, row.storage_path ?? url) });
      setOpen(false);
    } catch { setError('This model could not be loaded.'); }
    finally { setLoading(null); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className}><Library /> Add from library</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        {!user ? <p className="p-2 text-sm text-muted-foreground">Sign in to use models from your library.</p>
          : !rows ? <p className="p-2 text-sm text-muted-foreground">Loading…</p>
          : rows.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No saved 3D models yet.</p>
          : <ul className="max-h-64 space-y-1 overflow-auto">{rows.map(row => (
            <li key={row.id}>
              <Button variant="ghost" className="w-full justify-between" disabled={!!loading} onClick={() => void pick(row)}>
                <span className="truncate">{row.ref_code}</span>
                {loading === row.id ? <Loader2 className="animate-spin" /> : <span className="text-xs text-muted-foreground">{row.recipe}</span>}
              </Button>
            </li>))}</ul>}
        {error && <p role="alert" className="p-2 text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
