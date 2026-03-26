'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STOCK_PRESETS_IMPERIAL, STOCK_PRESETS_METRIC } from '@/lib/optimizer/types';
import { Units } from '@/lib/fractions';

interface StockPresetSelectProps {
  onSelect: (length: number, width: number) => void;
  units?: Units;
}

export function StockPresetSelect({ onSelect, units = 'imperial' }: StockPresetSelectProps) {
  const presets = units === 'metric' ? STOCK_PRESETS_METRIC : STOCK_PRESETS_IMPERIAL;

  return (
    <Select
      onValueChange={(val) => {
        if (val === 'custom') return;
        const preset = presets.find((p) => p.label === val);
        if (preset) onSelect(preset.length, preset.width);
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Sheet size..." />
      </SelectTrigger>
      <SelectContent>
        {presets.map((preset) => (
          <SelectItem key={preset.label} value={preset.label}>
            {preset.label}
          </SelectItem>
        ))}
        <SelectItem value="custom">Custom size</SelectItem>
      </SelectContent>
    </Select>
  );
}
