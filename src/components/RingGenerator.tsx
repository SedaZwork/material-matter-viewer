import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Sparkles, Box, ArrowRight, Loader2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Stage = 'idle' | 'generating-image' | 'image-ready' | 'generating-3d' | 'model-ready';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS_IMAGE = 60;     // ~3 min
const MAX_POLLS_MODEL = 120;    // ~6 min

const RingGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [prompt, setPrompt] = useState(
    'minimalist architectural band, organic flowing structure, parametric geometry, brushed silver finish'
  );
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [uploadedRefPath, setUploadedRefPath] = useState<string | null>(null);
  const [uploadedRefPreview, setUploadedRefPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [conceptImageUrl, setConceptImageUrl] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [modelStoragePath, setModelStoragePath] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // 3D preview of the generated GLB
  const previewRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const newRefCode = () =>
    '0K3D-' +
    Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

  // ── Reference image upload to 0K3D_Modelos_Generados/references/<uid>/ ─
  const handleReferenceFile = async (file: File) => {
    if (!user) {
      toast({
        title: 'Sign in to upload',
        description: 'Uploading a reference image requires an account.',
        variant: 'destructive',
      });
      navigate('/auth?returnTo=/ring-generator');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Image files only', variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 8 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `references/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('0K3D_Modelos_Generados')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from('0K3D_Modelos_Generados')
        .createSignedUrl(path, 60 * 60 * 2);
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Signed URL failed');
      setUploadedRefPath(path);
      setUploadedRefPreview(signed.signedUrl);
      setReferenceImageUrl(signed.signedUrl);
      toast({ title: 'Reference uploaded' });
    } catch (err) {
      logger.error('Reference upload failed', err);
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };


  // ── Step 1: Nano Banana concept generation ────────────────────────────
  const generateConcept = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Add a description', description: 'Describe the ring you want.', variant: 'destructive' });
      return;
    }
    setStage('generating-image');
    setStatusMsg('Submitting prompt to Nano Banana…');
    setConceptImageUrl(null);
    setModelUrl(null);

    try {
      const { data: createRes, error: createErr } = await supabase.functions.invoke('kie-nano-banana', {
        body: {
          action: 'create',
          prompt,
          recipe: 'ring',
          imageUrls: referenceImageUrl.trim() ? [referenceImageUrl.trim()] : undefined,
          imageSize: '1:1',
          outputFormat: 'png',
        },
      });
      if (createErr || !createRes?.taskId) throw new Error(createErr?.message || 'Failed to create task');

      const taskId = createRes.taskId as string;
      setStatusMsg('Rendering concept image…');

      for (let i = 0; i < MAX_POLLS_IMAGE; i++) {
        await sleep(POLL_INTERVAL_MS);
        const { data: statusRes } = await supabase.functions.invoke('kie-nano-banana', {
          body: { action: 'status', taskId },
        });
        if (statusRes?.state === 'success' && statusRes?.imageUrl) {
          setConceptImageUrl(statusRes.imageUrl);
          setStage('image-ready');
          setStatusMsg('');
          toast({ title: 'Concept ready', description: 'Generate the 3D model when you’re happy with the image.' });
          return;
        }
        if (statusRes?.state === 'fail') throw new Error('Generation failed');
        setStatusMsg(`Rendering concept image… (${i + 1}/${MAX_POLLS_IMAGE})`);
      }
      throw new Error('Timeout waiting for concept image');
    } catch (err) {
      logger.error('Concept generation failed', err);
      toast({
        title: 'Concept generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setStage('idle');
      setStatusMsg('');
    }
  };

  // ── Step 2: Trellis image → 3D ────────────────────────────────────────
  const generate3D = async () => {
    if (!conceptImageUrl) return;
    setStage('generating-3d');
    setStatusMsg('Submitting image to Trellis…');
    setModelUrl(null);

    try {
      const { data: createRes, error: createErr } = await supabase.functions.invoke('piapi-trellis', {
        body: { action: 'create', imageUrl: conceptImageUrl },
      });
      if (createErr || !createRes?.taskId) throw new Error(createErr?.message || 'Failed to create 3D task');

      const taskId = createRes.taskId as string;
      setStatusMsg('Reconstructing 3D geometry…');

      for (let i = 0; i < MAX_POLLS_MODEL; i++) {
        await sleep(POLL_INTERVAL_MS);
        const { data: statusRes } = await supabase.functions.invoke('piapi-trellis', {
          body: { action: 'status', taskId },
        });
        const s = statusRes?.state;
        if ((s === 'completed' || s === 'success') && statusRes?.modelUrl) {
          // Mirror the model into our bucket under a fresh ref code.
          const code = newRefCode();
          setStatusMsg('Saving model to your library…');
          const { data: mirror, error: mirrorErr } = await supabase.functions.invoke(
            'mirror-generated-model',
            { body: { sourceUrl: statusRes.modelUrl, refCode: code } },
          );
          if (mirrorErr || !mirror?.signedUrl) {
            logger.error('Mirror failed, falling back to source URL', mirrorErr);
            setModelUrl(statusRes.modelUrl);
          } else {
            setModelUrl(mirror.signedUrl);
            setModelStoragePath(mirror.path);
            setRefCode(code);
          }
          setStage('model-ready');
          setStatusMsg('');
          toast({
            title: '3D model ready',
            description: code ? `Saved as ${code}` : 'Continue to material selection & quoting.',
          });
          return;
        }
        if (s === 'failed' || s === 'fail') throw new Error('3D generation failed');
        setStatusMsg(`Reconstructing 3D geometry… (${i + 1}/${MAX_POLLS_MODEL})`);
      }
      throw new Error('Timeout waiting for 3D model');
    } catch (err) {
      logger.error('3D generation failed', err);
      toast({
        title: '3D generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setStage('image-ready');
      setStatusMsg('');
    }
  };

  // ── Step 3: Preview GLB and hand off geometry to main customizer ──────
  useEffect(() => {
    if (!modelUrl || !previewRef.current) return;
    const container = previewRef.current;
    const width = container.clientWidth;
    const height = 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f5f8);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2, 1.5, 2);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let raf = 0;
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        const scale = 1.5 / size;
        gltf.scene.scale.setScalar(scale);
        scene.add(gltf.scene);
      },
      undefined,
      (err) => logger.error('GLB load failed', err)
    );

    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
    return () => cleanupRef.current?.();
  }, [modelUrl]);

  const continueToCustomizer = async () => {
    if (!modelUrl) return;
    try {
      setStatusMsg('Preparing model for the customizer…');
      // Load GLB, merge all meshes into one BufferGeometry in world space.
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl);

      // Collect transformed positions + normals from every mesh.
      const positions: number[] = [];
      const normals: number[] = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!(mesh as any).isMesh || !mesh.geometry) return;
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(mesh.matrixWorld);
        const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
        const pos = nonIndexed.getAttribute('position') as THREE.BufferAttribute;
        const nor = nonIndexed.getAttribute('normal') as THREE.BufferAttribute | undefined;
        for (let i = 0; i < pos.count; i++) {
          positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        }
      });

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (normals.length === positions.length) {
        merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      } else {
        merged.computeVertexNormals();
      }

      // Normalize size to ~50mm bounding-box max (ring-sized) so cost calc is sane.
      merged.computeBoundingBox();
      const size = new THREE.Vector3();
      merged.boundingBox!.getSize(size);
      const target = 50; // mm
      const factor = target / Math.max(size.x, size.y, size.z);
      merged.applyMatrix4(new THREE.Matrix4().makeScale(factor, factor, factor));
      merged.computeBoundingBox();

      sessionStorage.setItem('transferGeometryJSON', JSON.stringify(merged.toJSON()));
      sessionStorage.removeItem('vesselSTL');
      // Hand off generation context so checkout can record it on the print job.
      sessionStorage.setItem(
        'ringGenerationContext',
        JSON.stringify({
          source: 'generated',
          refCode,
          modelStoragePath,
          conceptImageUrl,
          generationPrompt: prompt,
          generationMetadata: {
            providers: { image: 'kie/nano-banana', mesh: 'piapi/trellis' },
            referenceImagePath: uploadedRefPath,
            referenceImageUrl: referenceImageUrl || null,
            createdAt: new Date().toISOString(),
          },
        }),
      );
      merged.dispose();
      navigate('/', { state: { fromVessel: true } });
    } catch (err) {
      logger.error('Failed to hand off model', err);
      toast({
        title: 'Failed to load model',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      setStatusMsg('');
    }
  };

  const busy = stage === 'generating-image' || stage === 'generating-3d';

  return (
    <div className="min-h-screen" style={{ background: '#c9d0d6' }}>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_55%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-black/70 hover:text-black">
          <ArrowLeft className="w-4 h-4" /> Back to recipes
        </button>
        <div className="text-xs uppercase tracking-[0.4em] text-black/55">
          0K3D · Ring Recipe
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-10 pb-16 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-light text-[#111] tracking-tight">Structural Ring</h1>
          <p className="text-sm text-black/60 mt-2 max-w-xl">
            Describe your ring (and optionally drop a reference image URL). Nano Banana generates a
            product concept, Trellis reconstructs the 3D model, and you can quote it for printing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="rounded-[24px] border border-white/40 bg-white/35 backdrop-blur-2xl p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.3em] text-black/55">Step 1 — Concept</div>

            <div className="space-y-1.5">
              <Label className="text-xs text-black/70">Describe your ring</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="bg-white/60 border-white/50 text-sm"
                disabled={busy}
                placeholder="e.g. chunky signet ring with wave texture, brushed gold"
              />
              <p className="text-[11px] text-black/50">
                Just describe the ring itself — shape, style, finish. The recipe automatically
                enforces a single closed printable body, isolated on white, ready for image-to-3D.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-black/70">Reference image (optional)</Label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleReferenceFile(f);
                  e.currentTarget.value = '';
                }}
              />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white/60 border-white/60"
                  disabled={busy || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload image</>
                  )}
                </Button>
                {uploadedRefPreview && (
                  <div className="flex items-center gap-2">
                    <img
                      src={uploadedRefPreview}
                      alt="Reference"
                      className="w-10 h-10 rounded-md object-cover border border-white/60"
                    />
                    <button
                      type="button"
                      className="text-[11px] text-black/55 underline hover:text-black"
                      onClick={() => {
                        setUploadedRefPath(null);
                        setUploadedRefPreview(null);
                        setReferenceImageUrl('');
                      }}
                    >
                      remove
                    </button>
                  </div>
                )}
              </div>

              <Input
                value={uploadedRefPreview ? '' : referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="…or paste an image URL"
                className="bg-white/60 border-white/50 text-sm"
                disabled={busy || !!uploadedRefPreview}
              />
              <p className="text-[11px] text-black/50">
                When provided, Nano Banana Edit uses it as the visual reference.
              </p>
            </div>

            <Button
              onClick={generateConcept}
              disabled={busy}
              className="w-full bg-[#1f2328] text-white hover:bg-black"
            >
              {stage === 'generating-image' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate concept image</>
              )}
            </Button>

            {(stage === 'image-ready' || stage === 'generating-3d' || stage === 'model-ready') && (
              <>
                <div className="border-t border-white/40 pt-4" />
                <div className="text-xs uppercase tracking-[0.3em] text-black/55">Step 2 — 3D Model</div>
                <Button
                  onClick={generate3D}
                  disabled={busy || !conceptImageUrl}
                  variant="outline"
                  className="w-full bg-white/50 border-white/60 hover:bg-white/70"
                >
                  {stage === 'generating-3d' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reconstructing…</>
                  ) : (
                    <><Box className="w-4 h-4 mr-2" /> Generate 3D model (Trellis)</>
                  )}
                </Button>
              </>
            )}

            {stage === 'model-ready' && (
              <Button
                onClick={continueToCustomizer}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Continue to 3D Print & Material Selection <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {statusMsg && (
              <div className="text-xs text-black/60 flex items-center gap-2">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} {statusMsg}
              </div>
            )}
          </div>

          {/* Right: previews */}
          <div className="rounded-[24px] border border-white/40 bg-white/35 backdrop-blur-2xl p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.3em] text-black/55">Preview</div>

            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-white/40 border border-white/50 flex items-center justify-center">
              {conceptImageUrl ? (
                <img src={conceptImageUrl} alt="Generated ring concept" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-black/40">Concept image will appear here</div>
              )}
            </div>

            <div
              ref={previewRef}
              className="w-full rounded-2xl overflow-hidden bg-white/40 border border-white/50"
              style={{ height: modelUrl ? 360 : 0 }}
            />
            {modelUrl && (
              <a href={modelUrl} download className="text-[11px] text-black/55 hover:text-black underline">
                Download .glb
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RingGenerator;
