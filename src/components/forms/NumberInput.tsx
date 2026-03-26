'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { parseDimension, formatDimension, parseInput, formatDisplay, Units } from '@/lib/fractions';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  /** If true, uses fractional/metric display (for dimension fields). */
  fractional?: boolean;
  /** Unit system — if provided, overrides fractional parsing for dimensions. */
  units?: Units;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  min = 0,
  fractional = false,
  units,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  // Determine display format
  const getDisplay = useCallback((v: number): string => {
    if (v === 0) return '';
    if (units) return formatDisplay(v, units);
    if (fractional) return formatDimension(v);
    return String(v);
  }, [units, fractional]);

  const displayValue = focused ? rawText : getDisplay(value);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRawText(getDisplay(value));
  }, [value, getDisplay]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    let parsed: number;
    if (units) {
      parsed = parseInput(rawText, units);
    } else if (fractional) {
      parsed = parseDimension(rawText);
    } else {
      parsed = parseFloat(rawText);
    }
    if (!isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    }
  }, [rawText, onChange, min, fractional, units]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRawText(e.target.value),
    []
  );

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
}
