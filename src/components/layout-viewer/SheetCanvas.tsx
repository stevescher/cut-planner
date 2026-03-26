'use client';

import { useCallback, useRef, useState } from 'react';
import { SheetLayout, StockSheet, Placement } from '@/lib/optimizer/types';
import { useViewStore } from '@/store/useViewStore';
import { useDragStore } from '@/store/useDragStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { getColor } from '@/lib/colors';
import { formatDimension } from '@/lib/fractions';
import { Pin, PinOff } from 'lucide-react';

interface SheetCanvasProps {
  sheetLayout: SheetLayout;
  stockSheet: StockSheet;
  sheetNumber: number;
}

const PADDING = 40;
const MAX_WIDTH = 800;

export function SheetCanvas({ sheetLayout, stockSheet, sheetNumber }: SheetCanvasProps) {
  const { showLabels, monoMode, showCutSequence } = useViewStore();
  const { togglePin, isPinned } = useDragStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    placementIndex: number;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const sheetKey = `${stockSheet.id}-${sheetLayout.sheetIndex}`;
  const sheetW = stockSheet.length;
  const sheetH = stockSheet.width;
  const scale = Math.min((MAX_WIDTH - PADDING * 2) / sheetW, 400 / sheetH);
  const svgW = sheetW * scale + PADDING * 2;
  const svgH = sheetH * scale + PADDING * 2;

  const getSvgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      return { x: (svgPt.x - PADDING) / scale, y: (svgPt.y - PADDING) / scale };
    },
    [scale]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, placementIndex: number) => {
      if (e.button !== 0) return;
      const p = sheetLayout.placements[placementIndex];
      const svgPt = getSvgPoint(e.clientX, e.clientY);

      setDragState({
        placementIndex,
        offsetX: svgPt.x - p.x,
        offsetY: svgPt.y - p.y,
        currentX: p.x,
        currentY: p.y,
      });

      (e.target as Element).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [sheetLayout.placements, getSvgPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;
      const svgPt = getSvgPoint(e.clientX, e.clientY);
      const p = sheetLayout.placements[dragState.placementIndex];

      // Clamp to sheet bounds
      let newX = svgPt.x - dragState.offsetX;
      let newY = svgPt.y - dragState.offsetY;
      newX = Math.max(0, Math.min(newX, sheetW - p.width));
      newY = Math.max(0, Math.min(newY, sheetH - p.height));

      setDragState((prev) => prev ? { ...prev, currentX: newX, currentY: newY } : null);
    },
    [dragState, getSvgPoint, sheetLayout.placements, sheetW, sheetH]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragState) return;

    const p = sheetLayout.placements[dragState.placementIndex];
    const newX = dragState.currentX;
    const newY = dragState.currentY;

    // Snap to nearest grid position (1" grid)
    const snappedX = Math.round(newX * 4) / 4;
    const snappedY = Math.round(newY * 4) / 4;

    // Check if position actually changed meaningfully
    if (Math.abs(snappedX - p.x) > 0.1 || Math.abs(snappedY - p.y) > 0.1) {
      // Save current state for undo
      const layoutStore = useLayoutStore.getState();
      const historyStore = useHistoryStore.getState();
      historyStore.pushState({
        solutions: layoutStore.solutions,
        activeSolutionIndex: layoutStore.activeSolutionIndex,
      });

      // Update the placement position
      const updatedSolutions = layoutStore.solutions.map((sol, si) => {
        if (si !== layoutStore.activeSolutionIndex) return sol;
        return {
          ...sol,
          sheets: sol.sheets.map((sheet) => {
            if (
              sheet.stockSheetId !== stockSheet.id ||
              sheet.sheetIndex !== sheetLayout.sheetIndex
            )
              return sheet;
            return {
              ...sheet,
              placements: sheet.placements.map((pl, pi) => {
                if (pi !== dragState.placementIndex) return pl;
                return { ...pl, x: snappedX, y: snappedY };
              }),
            };
          }),
        };
      });
      layoutStore.setSolutions(updatedSolutions);

      // Auto-pin the moved piece
      if (!isPinned(sheetKey, dragState.placementIndex)) {
        togglePin(sheetKey, dragState.placementIndex);
      }
    }

    setDragState(null);
  }, [dragState, sheetLayout, stockSheet.id, sheetKey, isPinned, togglePin]);

  const handlePinClick = useCallback(
    (e: React.MouseEvent, placementIndex: number) => {
      e.stopPropagation();
      togglePin(sheetKey, placementIndex);
    },
    [sheetKey, togglePin]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Sheet {sheetNumber}
          {stockSheet.label && ` — ${stockSheet.label}`}
          <span className="text-muted-foreground ml-2">
            ({formatDimension(sheetW)} x {formatDimension(sheetH)})
          </span>
        </h4>
        <span className="text-xs text-muted-foreground">
          Waste: {sheetLayout.wastePercent.toFixed(1)}%
        </span>
      </div>

      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="border rounded bg-white select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Sheet outline */}
        <rect
          x={PADDING}
          y={PADDING}
          width={sheetW * scale}
          height={sheetH * scale}
          fill="#f9fafb"
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* Trim areas */}
        {stockSheet.trimTop > 0 && (
          <rect
            x={PADDING}
            y={PADDING}
            width={sheetW * scale}
            height={stockSheet.trimTop * scale}
            fill="#fee2e2"
            opacity={0.4}
          />
        )}
        {stockSheet.trimBottom > 0 && (
          <rect
            x={PADDING}
            y={PADDING + (sheetH - stockSheet.trimBottom) * scale}
            width={sheetW * scale}
            height={stockSheet.trimBottom * scale}
            fill="#fee2e2"
            opacity={0.4}
          />
        )}
        {stockSheet.trimLeft > 0 && (
          <rect
            x={PADDING}
            y={PADDING}
            width={stockSheet.trimLeft * scale}
            height={sheetH * scale}
            fill="#fee2e2"
            opacity={0.4}
          />
        )}
        {stockSheet.trimRight > 0 && (
          <rect
            x={PADDING + (sheetW - stockSheet.trimRight) * scale}
            y={PADDING}
            width={stockSheet.trimRight * scale}
            height={sheetH * scale}
            fill="#fee2e2"
            opacity={0.4}
          />
        )}

        {/* Placed pieces */}
        {sheetLayout.placements.map((p, i) => {
          const isDragging = dragState?.placementIndex === i;
          const pinned = isPinned(sheetKey, i);
          const displayX = isDragging ? dragState.currentX : p.x;
          const displayY = isDragging ? dragState.currentY : p.y;

          const px = PADDING + displayX * scale;
          const py = PADDING + displayY * scale;
          const pw = p.width * scale;
          const ph = p.height * scale;
          const color = monoMode ? getColor(i, true) : p.color;

          return (
            <g
              key={`${p.panelId}-${i}`}
              style={{ cursor: 'grab', opacity: isDragging ? 0.7 : 0.85 }}
              onPointerDown={(e) => handlePointerDown(e, i)}
            >
              <rect
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill={color}
                stroke={pinned ? '#f59e0b' : monoMode ? '#333' : '#fff'}
                strokeWidth={pinned ? 2.5 : monoMode ? 1.5 : 1}
                rx={1}
              />

              {/* Pin indicator */}
              {pinned && (
                <g
                  onClick={(e) => handlePinClick(e, i)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={px + pw - 10}
                    cy={py + 10}
                    r={8}
                    fill="#f59e0b"
                  />
                  <text
                    x={px + pw - 10}
                    y={py + 10}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    className="text-[8px]"
                  >
                    P
                  </text>
                </g>
              )}

              {showLabels && pw > 30 && ph > 20 && (
                <>
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2 - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-medium pointer-events-none"
                    fill={monoMode ? '#000' : '#fff'}
                  >
                    {p.label || p.panelId.slice(0, 6)}
                  </text>
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2 + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[8px] pointer-events-none"
                    fill={monoMode ? '#555' : 'rgba(255,255,255,0.8)'}
                  >
                    {formatDimension(p.width)} x {formatDimension(p.height)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Cut sequence overlay */}
        {showCutSequence &&
          sheetLayout.cutSequence.map((cut) => (
            <g key={`cut-${cut.stepNumber}`}>
              <line
                x1={PADDING + cut.x1 * scale}
                y1={PADDING + cut.y1 * scale}
                x2={PADDING + cut.x2 * scale}
                y2={PADDING + cut.y2 * scale}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <circle
                cx={PADDING + ((cut.x1 + cut.x2) / 2) * scale}
                cy={PADDING + ((cut.y1 + cut.y2) / 2) * scale}
                r={8}
                fill="#ef4444"
              />
              <text
                x={PADDING + ((cut.x1 + cut.x2) / 2) * scale}
                y={PADDING + ((cut.y1 + cut.y2) / 2) * scale}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                className="text-[9px] font-bold pointer-events-none"
              >
                {cut.stepNumber}
              </text>
            </g>
          ))}

        {/* Dimension labels on sheet edges */}
        <text
          x={PADDING + (sheetW * scale) / 2}
          y={PADDING - 8}
          textAnchor="middle"
          className="text-[11px] fill-muted-foreground"
        >
          {formatDimension(sheetW)}&quot;
        </text>
        <text
          x={PADDING - 8}
          y={PADDING + (sheetH * scale) / 2}
          textAnchor="middle"
          transform={`rotate(-90, ${PADDING - 8}, ${PADDING + (sheetH * scale) / 2})`}
          className="text-[11px] fill-muted-foreground"
        >
          {formatDimension(sheetH)}&quot;
        </text>
      </svg>
    </div>
  );
}
