import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PrintSettings as PrintSettingsType } from '@/types/materials';

interface PrintSettingsProps {
  settings: PrintSettingsType;
  onSettingsChange: (settings: PrintSettingsType) => void;
}

const PrintSettings: React.FC<PrintSettingsProps> = ({ settings, onSettingsChange }) => {
  const updateSetting = (key: keyof PrintSettingsType, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Print Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="volume">Volume (cm³)</Label>
          <Input
            id="volume"
            type="number"
            value={settings.volume}
            onChange={(e) => updateSetting('volume', parseFloat(e.target.value) || 0)}
            placeholder="Enter volume in cm³"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-3">
          <Label>Infill: {settings.infill}%</Label>
          <Slider
            value={[settings.infill]}
            onValueChange={(value) => updateSetting('infill', value[0])}
            max={100}
            min={0}
            step={5}
            className="w-full"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="supports"
            checked={settings.supports}
            onCheckedChange={(checked) => updateSetting('supports', checked)}
          />
          <Label htmlFor="supports">Support material required</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="printTime">Estimated print time (hours)</Label>
          <Input
            id="printTime"
            type="number"
            value={settings.estimatedPrintTime}
            onChange={(e) => updateSetting('estimatedPrintTime', parseFloat(e.target.value) || 0)}
            placeholder="Hours"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="laborCost">Labor cost per hour ($)</Label>
          <Input
            id="laborCost"
            type="number"
            value={settings.laborCostPerHour}
            onChange={(e) => updateSetting('laborCostPerHour', parseFloat(e.target.value) || 0)}
            placeholder="$/hour"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="electricityCost">Electricity cost per kWh ($)</Label>
          <Input
            id="electricityCost"
            type="number"
            step="0.01"
            value={settings.electricityCostPerKwh}
            onChange={(e) => updateSetting('electricityCostPerKwh', parseFloat(e.target.value) || 0)}
            placeholder="$/kWh"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="printerPower">Printer power consumption (W)</Label>
          <Input
            id="printerPower"
            type="number"
            value={settings.printerPowerConsumption}
            onChange={(e) => updateSetting('printerPowerConsumption', parseFloat(e.target.value) || 0)}
            placeholder="Watts"
            className="bg-background border-border"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintSettings;