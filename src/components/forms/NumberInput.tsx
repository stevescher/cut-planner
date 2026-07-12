'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { parseDimension, formatDimension, parseInput, formatDisplay, parseStrictNumber, Units } from '@/lib/fractions';
import { cn } from '@/lib/utils';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  /** If true, uses fractional/metric display (for dimension fields). */
  fractional?: boolean;
  /** Unit system — if provided, overrides fractional parsing for dimensions. */
  units?: Units;
  'aria-label'?: string;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  min = 0,
  max,
  fractional = false,
  units,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');
  const [invalid, setInvalid] = useState(false);

  // Determine display format
  const getDisplay = useCallback((v: number): string => {
    if (v === 0) return '';
    if (units) return formatDisplay(v, units);
    if (fractional) return formatDimension(v);
    return String(v);
  }, [units, fractional]);

  const parse = useCallback((text: string): number => {
    if (units) return parseInput(text, units);
    if (fractional) return parseDimension(text);
    // Generic numeric fields (e.g. quantity) — strict, so "3x" or "1.2.3" is
    // rejected rather than silently coerced to a numeric prefix. (OPUS-406)
    return parseStrictNumber(text);
  }, [units, fractional]);

  // While focused, or while showing a rejected value, display the raw text the
  // user typed so they can see and correct it. Only fall back to the formatted
  // stored value once the input is valid and blurred.
  const displayValue = focused || invalid ? rawText : getDisplay(value);

  const handleFocus = useCallback(() => {
    setFocused(true);
    // Re-entering an invalid field keeps the rejected text so the user can edit
    // it; entering a valid field seeds the editable raw text from the value.
    if (!invalid) setRawText(getDisplay(value));
  }, [value, getDisplay, invalid]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const trimmed = rawText.trim();
    // Empty clears to 0 (a legitimately blank field), not an error.
    if (trimmed === '') {
      setInvalid(false);
      onChange(0);
      return;
    }
    const parsed = parse(trimmed);
    const outOfRange = isNaN(parsed) || parsed < min || (max !== undefined && parsed > max);
    if (outOfRange) {
      // Keep the entered text and flag it instead of silently reverting, so the
      // user can see and fix what they typed.
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(parsed);
  }, [rawText, onChange, min, max, parse]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRawText(e.target.value);
      if (invalid) setInvalid(false); // clear the flag as the user edits
    },
    [invalid]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  }, []);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn(invalid && 'border-red-400 focus-visible:ring-red-400/40', className)}
    />
  );
}
