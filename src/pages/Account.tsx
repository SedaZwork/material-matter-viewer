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
import {
  LengthUnit, BodyUnit, WeightUnit,
  toMm, fromMm, toCm, fromCm, toKg, fromKg,
  round, validateMetric, parseNumber,
  ringSizeUsToDiameterMm, ringDiameterMmToSizeUs,
} from '@/utils/measurements';
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

type FieldKind = 'length' | 'body' | 'weight' | 'plain';

const FIELD_KIND: Record<Exclude<keyof Measurements, 'notes'>, FieldKind> = {
  ring_diameter_mm: 'length',
  ring_size_us: 'plain',
  foot_length_mm: 'length',
  foot_width_mm: 'length',
  shoe_size_eu: 'plain',
  height_cm: 'body',
  weight_kg: 'weight',
  chest_cm: 'body',
  waist_cm: 'body',
  hip_cm: 'body',
  wrist_cm: 'body',
  head_cm: 'body',
};

const Account: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [m, setM] = useState<Measurements>(EMPTY); // values held in the currently selected display units
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('mm');
  const [bodyUnit, setBodyUnit] = useState<BodyUnit>('cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ── unit helpers ───────────────────────────────────────────────
  const toMetric = (key: keyof Measurements, display: string): number | null | typeof NaN => {
    const n = parseNumber(display);
    if (n === null || Number.isNaN(n)) return n as any;
    switch (FIELD_KIND[key as Exclude<keyof Measurements, 'notes'>]) {
      case 'length': return toMm(n, lengthUnit);
      case 'body': return toCm(n, bodyUnit);
      case 'weight': return toKg(n, weightUnit);
      default: return n;
    }
  };

  const toDisplay = (key: keyof Measurements, metric: number): number => {
    switch (FIELD_KIND[key as Exclude<keyof Measurements, 'notes'>]) {
      case 'length': return round(fromMm(metric, lengthUnit), lengthUnit === 'mm' ? 2 : 3);
      case 'body': return round(fromCm(metric, bodyUnit), 2);
      case 'weight': return round(fromKg(metric, weightUnit), 2);
      default: return round(metric, 2);
    }
  };

  const errors = React.useMemo(() => {
    const e: Partial<Record<keyof Measurements, string>> = {};
    (Object.keys(FIELD_KIND) as (keyof Measurements)[]).forEach((k) => {
      const v = toMetric(k, m[k]);
      if (typeof v === 'number' && Number.isNaN(v)) {
        e[k] = 'Enter a valid number';
        return;
      }
      const msg = validateMetric(k as string, v as number | null);
      if (msg) e[k] = msg;
    });
    return e;
  }, [m, lengthUnit, bodyUnit, weightUnit]);

  const hasErrors = Object.keys(errors).length > 0;

  // Convert already-entered display values when a unit toggle changes.
  const switchUnit = (kind: FieldKind, next: string) => {
    setM((s) => {
      const out: any = { ...s };
      (Object.keys(FIELD_KIND) as (keyof Measurements)[]).forEach((k) => {
        if (FIELD_KIND[k as Exclude<keyof Measurements, 'notes'>] !== kind) return;
        const n = parseNumber(s[k]);
        if (n === null || Number.isNaN(n)) return;
        let metric = n;
        if (kind === 'length') metric = toMm(n, lengthUnit);
        if (kind === 'body') metric = toCm(n, bodyUnit);
        if (kind === 'weight') metric = toKg(n, weightUnit);
        let converted = metric;
        if (kind === 'length') converted = fromMm(metric, next as LengthUnit);
        if (kind === 'body') converted = fromCm(metric, next as BodyUnit);
        if (kind === 'weight') converted = fromKg(metric, next as WeightUnit);
        out[k] = String(round(converted, kind === 'length' && next === 'in' ? 3 : 2));
      });
      return out;
    });
    if (kind === 'length') setLengthUnit(next as LengthUnit);
    if (kind === 'body') setBodyUnit(next as BodyUnit);
    if (kind === 'weight') setWeightUnit(next as WeightUnit);
  };

  const unitToggle = (kind: FieldKind, options: string[], current: string) => (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => current !== o && switchUnit(kind, o)}
          className={`px-2 py-0.5 text-[11px] transition-colors ${
            current === o ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-secondary'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );

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
          if (v === null || v === undefined) { next[k] = ''; return; }
          next[k] = k === 'notes' ? String(v) : String(toDisplay(k as keyof Measurements, Number(v)));
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
    if (hasErrors) {
      toast.error('Please fix the highlighted measurements first');
      return;
    }
    setSaving(true);
    const payload: any = { user_id: user.id, scan_source: 'manual' };
    (Object.keys(EMPTY) as (keyof Measurements)[]).forEach((k) => {
      if (k === 'notes') { payload[k] = m[k]?.trim() ? m[k].trim().slice(0, 1000) : null; return; }
      const v = toMetric(k, m[k]);
      payload[k] = typeof v === 'number' && !Number.isNaN(v) ? round(v, 2) : null;
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

  // Keep US ring size and inner diameter in sync.
  const handleChange = (key: keyof Measurements, value: string) => {
    setM((s) => {
      const next = { ...s, [key]: value };
      const n = parseNumber(value);
      const valid = n !== null && !Number.isNaN(n);
      if (key === 'ring_diameter_mm') {
        next.ring_size_us = valid ? String(ringDiameterMmToSizeUs(toMm(n as number, lengthUnit))) : '';
      } else if (key === 'ring_size_us') {
        next.ring_diameter_mm = valid
          ? String(round(fromMm(ringSizeUsToDiameterMm(n as number), lengthUnit), lengthUnit === 'mm' ? 2 : 3))
          : '';
      }
      return next;
    });
  };

  const field = (key: keyof Measurements, label: string, unit?: string, step = '0.1') => {
    const kind = FIELD_KIND[key as Exclude<keyof Measurements, 'notes'>];
    const shownUnit =
      kind === 'length' ? lengthUnit : kind === 'body' ? bodyUnit : kind === 'weight' ? weightUnit : unit;
    const err = errors[key];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {label}{shownUnit && <span className="ml-1 opacity-60">({shownUnit})</span>}
        </Label>
        <Input
          type="number" inputMode="decimal" step={step}
          value={m[key]}
          onChange={(e) => handleChange(key, e.target.value)}
          aria-invalid={!!err}
          className={`h-9 ${err ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {err && <p className="text-[10px] text-destructive leading-tight">{err}</p>}
      </div>
    );
  };


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
