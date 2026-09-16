import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScanLine, Upload, AlertTriangle, Check } from 'lucide-react';
import {
  loadScanGeometry, measureScan, guessUnit, SCAN_KIND_LABEL, SUPPORTED_SCAN_EXTENSIONS,
  type ScanKind, type ScanUnit, type ScanMeasurements, type ScanResult,
} from '@/utils/scanMeasure';
import { RANGES } from '@/utils/measurements';
import { logger } from '@/utils/logger';

const FIELD_LABEL: Record<string, string> = {
  ring_diameter_mm: 'Ring inner diameter',
  foot_length_mm: 'Foot length',
  foot_width_mm: 'Foot width',
  shoe_size_eu: 'EU shoe size',
  height_cm: 'Height',
  chest_cm: 'Chest',
  waist_cm: 'Waist',
  hip_cm: 'Hip',
  wrist_cm: 'Wrist',
  head_cm: 'Head',
};

interface ScanUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives metric values (mm / cm) ready to store. */
  onApply: (measurements: ScanMeasurements) => void;
}

const ScanUpload: React.FC<ScanUploadProps> = ({ open, onOpenChange, onApply }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [kind, setKind] = useState<ScanKind>('finger');
  const [unit, setUnit] = useState<ScanUnit>('mm');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const recompute = (nextKind: ScanKind, nextUnit: ScanUnit) => {
    if (!geomRef.current) return;
    try {
      setResult(measureScan(geomRef.current, nextKind, nextUnit));
      setError(null);
    } catch (e) {
      logger.error('measure scan', e);
      setError('Could not measure this scan.');
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const geom = await loadScanGeometry(file);
      geomRef.current = geom;
      setFileName(file.name);
      const u = guessUnit(geom, kind);
      setUnit(u);
      setResult(measureScan(geom, kind, u));
    } catch (e) {
      logger.error('load scan', e);
      geomRef.current = null;
      setFileName(null);
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    } finally {
      setBusy(false);
    }
  };

  const entries = Object.entries(result?.measurements ?? {}) as [string, number][];

  const outOfRange = (key: string, value: number) => {
    const r = RANGES[key];
    return r ? value < r.min || value > r.max : false;
  };

  const apply = () => {
    if (!result) return;
    onApply(result.measurements);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="w-4 h-4" /> Measure from a 3D scan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload a scan ({SUPPORTED_SCAN_EXTENSIONS.join(', ')}) taken with your phone or a scanner.
            Measurements are read from the mesh and filled into your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">What did you scan?</Label>
              <Select
                value={kind}
                onValueChange={(v) => { setKind(v as ScanKind); recompute(v as ScanKind, unit); }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCAN_KIND_LABEL) as ScanKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{SCAN_KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Scan units</Label>
              <Select
                value={unit}
                onValueChange={(v) => { setUnit(v as ScanUnit); recompute(kind, v as ScanUnit); }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['mm', 'cm', 'm', 'in'] as ScanUnit[]).map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-16 border-dashed border-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-5 h-5" />
              <span className="text-xs">
                {busy ? 'Reading scan…' : fileName ?? 'Choose a scan file'}
              </span>
            </div>
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTED_SCAN_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleFile(f);
            }}
          />

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{result.triangles.toLocaleString()} triangles</span>
                <span>
                  {result.bboxMm.x} × {result.bboxMm.y} × {result.bboxMm.z} mm
                </span>
              </div>

              {entries.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {entries.map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs">{FIELD_LABEL[k] ?? k}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {v}{k.endsWith('_mm') ? ' mm' : k.endsWith('_cm') ? ' cm' : ''}
                        </span>
                        {outOfRange(k, v) && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-destructive text-destructive">
                            check units
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {result.warnings.map((w) => (
                <p key={w} className="text-[11px] text-muted-foreground leading-tight">{w}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={!result || entries.length === 0}>
            <Check className="w-4 h-4 mr-1.5" /> Use these measurements
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScanUpload;
