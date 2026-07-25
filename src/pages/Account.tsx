import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Ruler, Package, FileBox, ScanLine, Save } from 'lucide-react';
import { logger } from '@/utils/logger';

type Measurements = {
  ring_diameter_mm: string;
  ring_size_us: string;
  foot_length_mm: string;
  foot_width_mm: string;
  shoe_size_eu: string;
  height_cm: string;
  weight_kg: string;
  chest_cm: string;
  waist_cm: string;
  hip_cm: string;
  wrist_cm: string;
  head_cm: string;
  notes: string;
};

const EMPTY: Measurements = {
  ring_diameter_mm: '', ring_size_us: '',
  foot_length_mm: '', foot_width_mm: '', shoe_size_eu: '',
  height_cm: '', weight_kg: '',
  chest_cm: '', waist_cm: '', hip_cm: '',
  wrist_cm: '', head_cm: '', notes: '',
};

const numOrNull = (v: string) => (v === '' || v === null || isNaN(Number(v)) ? null : Number(v));

const Account: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [m, setM] = useState<Measurements>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth?returnTo=/account');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_measurements')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) logger.error('load measurements', error);
      if (data) {
        const next: any = { ...EMPTY };
        Object.keys(EMPTY).forEach((k) => {
          const v = (data as any)[k];
          next[k] = v === null || v === undefined ? '' : String(v);
        });
        setM(next);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingJobs(true);
    supabase
      .from('print_jobs')
      .select('id, ref_code, status, material_name, final_cost, source, concept_image_url, model_storage_path, generation_prompt, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) logger.error('load jobs', error);
        setJobs(data ?? []);
        setLoadingJobs(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = { user_id: user.id, scan_source: 'manual' };
    (Object.keys(EMPTY) as (keyof Measurements)[]).forEach((k) => {
      payload[k] = k === 'notes' ? (m[k] || null) : numOrNull(m[k]);
    });
    const { error } = await supabase
      .from('user_measurements')
      .upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      logger.error('save measurements', error);
      toast.error('Could not save measurements');
    } else {
      toast.success('Measurements saved');
    }
  };

  const field = (key: keyof Measurements, label: string, unit?: string, step = '0.1') => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{unit && <span className="ml-1 opacity-60">({unit})</span>}</Label>
      <Input
        type="number" inputMode="decimal" step={step}
        value={m[key]}
        onChange={(e) => setM((s) => ({ ...s, [key]: e.target.value }))}
        className="h-9"
      />
    </div>
  );

  const generated = jobs.filter((j) => j.source && j.source !== 'upload');
  const purchased = jobs.filter((j) => j.status && j.status !== 'pending');

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">My Account</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 max-w-4xl">
        <Tabs defaultValue="measurements" className="space-y-4">
          <TabsList>
            <TabsTrigger value="measurements"><Ruler className="w-3.5 h-3.5 mr-1.5" /> Measurements</TabsTrigger>
            <TabsTrigger value="files"><FileBox className="w-3.5 h-3.5 mr-1.5" /> Files</TabsTrigger>
            <TabsTrigger value="orders"><Package className="w-3.5 h-3.5 mr-1.5" /> Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="measurements">
            <Card className="p-5 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Body measurements</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Used to auto-fit personalized recipes (rings, shoes, wearables). All fields optional.
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled className="shrink-0">
                  <ScanLine className="w-3.5 h-3.5 mr-1.5" /> Scan (coming soon)
                </Button>
              </div>

              <section className="space-y-2">
                <h3 className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Ring</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {field('ring_diameter_mm', 'Inner diameter', 'mm')}
                  {field('ring_size_us', 'US size', '')}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Foot</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {field('foot_length_mm', 'Length', 'mm')}
                  {field('foot_width_mm', 'Width', 'mm')}
                  {field('shoe_size_eu', 'EU shoe', '')}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">Body</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {field('height_cm', 'Height', 'cm')}
                  {field('weight_kg', 'Weight', 'kg')}
                  {field('chest_cm', 'Chest', 'cm')}
                  {field('waist_cm', 'Waist', 'cm')}
                  {field('hip_cm', 'Hip', 'cm')}
                  {field('wrist_cm', 'Wrist', 'cm')}
                  {field('head_cm', 'Head', 'cm')}
                </div>
              </section>

              <section className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  rows={3} value={m.notes}
                  onChange={(e) => setM((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Preferences, asymmetries, fit notes…"
                />
              </section>

              <div className="flex justify-end pt-2">
                <Button onClick={save} disabled={saving}>
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? 'Saving…' : 'Save measurements'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card className="p-5">
              <h2 className="text-sm font-semibold mb-3">Uploaded & generated files</h2>
              {loadingJobs ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : jobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files yet. Create a design to see it here.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.map((j) => (
                    <li key={j.id} className="py-3 flex items-center gap-3">
                      {j.concept_image_url ? (
                        <img src={j.concept_image_url} alt="" className="w-12 h-12 rounded-md object-cover border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center">
                          <FileBox className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono">{j.ref_code}</span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">{j.source || 'upload'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {j.generation_prompt || j.material_name}
                        </p>
                        {j.model_storage_path && (
                          <p className="text-[10px] text-muted-foreground/70 truncate">{j.model_storage_path}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(j.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="p-5">
              <h2 className="text-sm font-semibold mb-3">Purchased items</h2>
              {loadingJobs ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : purchased.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {purchased.map((j) => (
                    <li key={j.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono">{j.ref_code}</span>
                          <Badge className="text-[10px] py-0 h-4">{j.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{j.material_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">€{Number(j.final_cost ?? 0).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(j.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Account;
