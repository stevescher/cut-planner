'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STOCK_PRESETS } from '@/lib/optimizer/types';

interface StockPresetSelectProps {
  onSelect: (length: number, width: number) => void;
}

export function StockPresetSelect({ onSelect }: StockPresetSelectProps) {
  return (
    <Select
      onValueChange={(val) => {
        if (val === 'custom') return;
        const preset = STOCK_PRESETS.find((p) => p.label === val);
        if (preset) {
          onSelect(preset.length, preset.width);
        }
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Sheet size..." />
      </SelectTrigger>
      <SelectContent>
        {STOCK_PRESETS.map((preset) => (
          <SelectItem key={preset.label} value={preset.label}>
            {preset.label}
          </SelectItem>
        ))}
        <SelectItem value="custom">Custom size</SelectItem>
      </SelectContent>
    </Select>
  );
}
