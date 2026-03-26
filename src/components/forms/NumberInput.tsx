'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { parseDimension, formatDimension } from '@/lib/fractions';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  /** If true, shows fractional display (e.g. "12 1/2") */
  fractional?: boolean;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  min = 0,
  fractional = false,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  const displayValue = focused
    ? rawText
    : fractional
      ? formatDimension(value)
      : value === 0
        ? ''
        : String(value);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRawText(
      fractional ? formatDimension(value) : value === 0 ? '' : String(value)
    );
  }, [value, fractional]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = fractional ? parseDimension(rawText) : parseFloat(rawText);
    if (!isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    }
  }, [rawText, onChange, min, fractional]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRawText(e.target.value);
    },
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
