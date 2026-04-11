'use client';

import { useState, useRef } from 'react';
import { Upload, Download, X, AlertCircle, Check } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { parseInput } from '@/lib/fractions';
import { Panel } from '@/lib/optimizer/types';
import { nanoid } from 'nanoid';

interface ParsedRow {
  rowNum: number;
  label: string;
  length: number;
  width: number;
  qty: number;
  error?: string;
}

/** Parse a CSV text into rows, handling quoted fields */
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const fields: string[] = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (ch === ',' && !inQuote) {
          fields.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur.trim());
      return fields;
    });
}

/** Parse CSV text into preview rows, with per-row error messages */
function parseRows(csvText: string, units: 'imperial' | 'metric'): ParsedRow[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return [];

  // Detect header row — find column indices case-insensitively
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const colLabel = header.findIndex((h) => h === 'label' || h === 'name' || h === 'part');
  const colLength = header.findIndex((h) => h === 'length' || h === 'len' || h === 'l');
  const colWidth = header.findIndex((h) => h === 'width' || h === 'wid' || h === 'w');
  const colQty = header.findIndex((h) => h === 'qty' || h === 'quantity' || h === 'count' || h === 'q');

  if (colLength === -1 || colWidth === -1) {
    return [{
      rowNum: 1,
      label: '',
      length: 0,
      width: 0,
      qty: 1,
      error: 'Could not find "length" and "width" columns. Check your header row.',
    }];
  }

  const parsed: ParsedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const rawLabel = colLabel !== -1 ? row[colLabel] ?? '' : '';
    const rawLength = row[colLength] ?? '';
    const rawWidth = row[colWidth] ?? '';
    const rawQty = colQty !== -1 ? row[colQty] ?? '1' : '1';

    const length = parseInput(rawLength, units);
    const width = parseInput(rawWidth, units);
    const qty = Math.max(1, Math.round(parseFloat(rawQty) || 1));

    const errors: string[] = [];
    if (!isFinite(length) || length <= 0)
      errors.push(`invalid length "${rawLength}"`);
    if (!isFinite(width) || width <= 0)
      errors.push(`invalid width "${rawWidth}"`);

    parsed.push({
      rowNum,
      label: rawLabel,
      length: isFinite(length) && length > 0 ? length : 0,
      width: isFinite(width) && width > 0 ? width : 0,
      qty,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });
  }
  return parsed;
}

/** Download a template CSV */
function downloadTemplate(units: 'imperial' | 'metric') {
  const dim1 = units === 'metric' ? '600' : '24';
  const dim2 = units === 'metric' ? '300' : '12';
  const dim3 = units === 'metric' ? '400' : '16';
  const dim4 = units === 'metric' ? '200' : '8';
  const content = [
    'label,length,width,qty',
    `"Side Panel",${dim1},${dim2},2`,
    `"Shelf",${dim3},${dim4},4`,
    `"Top",${dim1},${dim4},1`,
  ].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'panel-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface PanelImportProps {
  onClose: () => void;
}

export function PanelImport({ onClose }: PanelImportProps) {
  const { panels, addPanel, updatePanel, units } = useProjectStore();
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [mergeMode, setMergeMode] = useState<'replace' | 'merge'>('replace');
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = parsedRows?.filter((r) => !r.error) ?? [];
  const errorRows = parsedRows?.filter((r) => r.error) ?? [];

  function handleFile(file: File) {
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setParsedRows([{ rowNum: 0, label: '', length: 0, width: 0, qty: 1, error: 'File too large (max 1 MB).' }]);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setParsedRows(parseRows(text, units));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleConfirm() {
    if (validRows.length === 0) return;

    // Build Panel objects
    const newPanels: Panel[] = validRows.map((r) => ({
      id: nanoid(),
      label: r.label,
      length: r.length,
      width: r.width,
      quantity: r.qty,
      lockRotation: false,
    }));

    if (mergeMode === 'replace') {
      // Replace all panels — reuse existing IDs where possible to avoid flash
      const store = useProjectStore.getState();
      // Remove extras
      const existingIds = store.panels.map((p) => p.id);
      // Add/update
      newPanels.forEach((p, i) => {
        if (i < existingIds.length) {
          store.updatePanel(existingIds[i], p);
        } else {
          store.addPanel(p);
        }
      });
      // Remove panels beyond the new count
      existingIds.slice(newPanels.length).forEach((id) => {
        // Only remove if there's more than 1 panel remaining
        if (useProjectStore.getState().panels.length > 1) {
          useProjectStore.getState().removePanel(id);
        }
      });
    } else {
      // Merge: append to existing list
      newPanels.forEach((p) => addPanel(p));
    }

    onClose();
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Import Panels from CSV</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drop zone */}
      {!parsedRows && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center
                     hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600 font-medium">Drop a CSV file here, or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Required columns: label, length, width, qty</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Download template */}
      <button
        onClick={() => downloadTemplate(units)}
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Download CSV template
      </button>

      {/* Preview */}
      {parsedRows && (
        <>
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{fileName}</span>
            {' — '}
            {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
            {errorRows.length > 0 && (
              <span className="text-red-500 ml-1">
                , {errorRows.length} error{errorRows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Rows table */}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 text-xs">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-slate-500 font-medium">#</th>
                  <th className="px-2 py-1 text-left text-slate-500 font-medium">Label</th>
                  <th className="px-2 py-1 text-right text-slate-500 font-medium">Length</th>
                  <th className="px-2 py-1 text-right text-slate-500 font-medium">Width</th>
                  <th className="px-2 py-1 text-right text-slate-500 font-medium">Qty</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row) => (
                  <tr
                    key={row.rowNum}
                    className={row.error ? 'bg-red-50' : 'even:bg-slate-50'}
                  >
                    <td className="px-2 py-1 text-slate-400">{row.rowNum}</td>
                    <td className="px-2 py-1 text-slate-700">{row.label || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-2 py-1 text-right text-slate-700">{row.error && row.length === 0 ? '—' : row.length}</td>
                    <td className="px-2 py-1 text-right text-slate-700">{row.error && row.width === 0 ? '—' : row.width}</td>
                    <td className="px-2 py-1 text-right text-slate-700">{row.qty}</td>
                    <td className="px-2 py-1">
                      {row.error
                        ? <AlertCircle className="h-3 w-3 text-red-400" aria-label={row.error} />
                        : <Check className="h-3 w-3 text-green-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error details */}
          {errorRows.length > 0 && (
            <div className="text-xs text-red-600 space-y-0.5">
              {errorRows.map((r) => (
                <div key={r.rowNum}>Row {r.rowNum}: {r.error}</div>
              ))}
            </div>
          )}

          {/* Merge mode */}
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mergeMode"
                value="replace"
                checked={mergeMode === 'replace'}
                onChange={() => setMergeMode('replace')}
                className="accent-indigo-600"
              />
              <span className="text-slate-700">Replace existing panels</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mergeMode"
                value="merge"
                checked={mergeMode === 'merge'}
                onChange={() => setMergeMode('merge')}
                className="accent-indigo-600"
              />
              <span className="text-slate-700">Append to existing</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={validRows.length === 0}
              className="flex-1 h-8 rounded-lg bg-indigo-600 text-white text-xs font-semibold
                         hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import {validRows.length} panel{validRows.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => { setParsedRows(null); setFileName(''); }}
              className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600
                         hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
