import jsPDF from 'jspdf';
import { Solution, StockSheet, Panel } from '@/lib/optimizer/types';
import { formatDisplay, unitSuffix, Units } from '@/lib/fractions';
import { safeFilename } from '@/lib/safe-export';
import { computeCost, formatCurrency } from '@/lib/cost';

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawPageFooter(pdf: jsPDF, projectName: string, pageNum: number, totalPages: number, pageW: number, pageH: number, margin: number) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(160, 160, 160);
  pdf.text(projectName || 'Cut Planner', margin, pageH - margin * 0.45);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - margin * 0.45, { align: 'right' });
}

// ── Page 1: Project summary + panels needed ──────────────────────────────────

export const ROW_H = 0.27;
// Vertical space drawTableHeader consumes between its start y and the first row:
// 0.3 (title→columns) + 0.08 (columns→rule) + 0.22 (rule→first row).
const TABLE_HEADER_H = 0.6;
const SUMMARY_FIRST_HEADER_Y = 1.25; // page-1 table header start (below title+stats)
const SUMMARY_CONT_HEADER_Y = 0.5;   // continuation-page table header start
export const SUMMARY_ROW_BOTTOM_MARGIN = 0.3;
export const SUMMARY_HEADER_STARTS = {
  first: SUMMARY_FIRST_HEADER_Y,
  cont: SUMMARY_CONT_HEADER_Y,
  headerHeight: TABLE_HEADER_H,
} as const;

/** Rows a summary page can hold, measured from where the first ROW is actually
 *  rendered (header start + header height) to the footer margin. */
export function summaryRowsFor(pageH: number, margin: number, firstPage: boolean): number {
  const headerStart = margin + (firstPage ? SUMMARY_FIRST_HEADER_Y : SUMMARY_CONT_HEADER_Y);
  const firstRowY = headerStart + TABLE_HEADER_H;
  const bottom = pageH - margin - 0.3; // leave room for footer
  return Math.max(1, Math.floor((bottom - firstRowY) / ROW_H) + 1);
}

/** How many pages the "Panels Needed" table will occupy. */
export function summaryPageCount(panelCount: number, pageH: number, margin: number): number {
  const first = summaryRowsFor(pageH, margin, true);
  if (panelCount <= first) return 1;
  const rest = summaryRowsFor(pageH, margin, false);
  return 1 + Math.ceil((panelCount - first) / rest);
}

/** Draw the summary + paginated panel table. Returns the number of pages used. */
function drawSummaryPage(
  pdf: jsPDF,
  solution: Solution,
  panels: Panel[],
  projectName: string,
  margin: number,
  pageW: number,
  pageH: number,
  totalPages: number,
  units: Units,
): number {
  const sfx = unitSuffix(units);
  const fmt = (v: number) => formatDisplay(v, units);
  let pageNum = 1;

  const drawTableHeader = (yStart: number): number => {
    let yy = yStart;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Panels Needed', margin, yy);
    yy += 0.3;
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Label', margin + 0.18, yy);
    pdf.text('Length', margin + 2.5, yy);
    pdf.text('Width', margin + 3.5, yy);
    pdf.text('Qty', margin + 4.5, yy);
    yy += 0.08;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.005);
    pdf.line(margin, yy, margin + 5.2, yy);
    yy += 0.22;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(40, 40, 40);
    return yy;
  };
  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(30, 30, 30);
  pdf.text(projectName || 'Cut Planner', margin, margin + 0.45);

  // Stats row
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  const stats = [
    `${solution.totalSheets} sheet${solution.totalSheets !== 1 ? 's' : ''}`,
    `${solution.totalWaste.toFixed(1)}% waste`,
    ...(solution.unplacedPanels.length > 0
      ? [`⚠ ${solution.unplacedPanels.reduce((s, p) => s + p.quantity, 0)} unplaced`]
      : []),
  ].join('   ·   ');
  pdf.text(stats, margin, margin + 0.75);

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.008);
  pdf.line(margin, margin + 0.95, pageW - margin, margin + 0.95);

  // Panels needed — paginate so a long list never runs off the page. The row
  // threshold and header-start constants are shared with summaryRowsFor so the
  // predicted page count (used for footer numbering) always matches what renders.
  let y = drawTableHeader(margin + SUMMARY_FIRST_HEADER_Y);
  const rowBottom = pageH - margin - 0.3;

  for (let i = 0; i < panels.length; i++) {
    if (y > rowBottom) {
      drawPageFooter(pdf, projectName, pageNum, totalPages, pageW, pageH, margin);
      pdf.addPage();
      pageNum++;
      y = drawTableHeader(margin + SUMMARY_CONT_HEADER_Y);
    }
    const p = panels[i];
    pdf.text(p.label || `Panel ${i + 1}`, margin + 0.18, y);
    pdf.text(`${fmt(p.length)}${sfx}`, margin + 2.5, y);
    pdf.text(`${fmt(p.width)}${sfx}`, margin + 3.5, y);
    pdf.text(String(p.quantity), margin + 4.5, y);
    y += ROW_H;
  }

  return pageNum;
}

// ── Cost breakdown page (optional) ───────────────────────────────────────────

// Cost-table geometry — shared between the row-capacity predictor and the
// renderer so predicted page count always matches what actually renders.
// Exported so the pagination test can simulate the render loop faithfully.
export const COST_ROW_H = 0.3;
const COST_HEADER_TITLE_Y = 0.45; // "Material Cost" title baseline (page-relative to margin)
const COST_HEADER_COLS_Y = 0.95;  // column-label row
const COST_FIRST_ROW_Y = COST_HEADER_COLS_Y + 0.08 + 0.28; // first data-row baseline
const COST_ROW_BOTTOM_MARGIN = 0.6;
// Vertical space the grand-total block needs after the last row (rule + Total +
// optional partial-estimate note). Reserved on the final page only.
const COST_TOTAL_BLOCK_H = 0.7;
export const COST_GEOMETRY = {
  rowH: COST_ROW_H,
  firstRowY: COST_FIRST_ROW_Y,
  rowBottomMargin: COST_ROW_BOTTOM_MARGIN,
  totalBlockH: COST_TOTAL_BLOCK_H,
} as const;

/**
 * Rows a cost page can hold. Every page reserves room for the total block, so
 * the grand total always fits after the last row on whatever page it lands —
 * this keeps the row-capacity uniform and the page-count predictor non-circular.
 */
function costRowsPerPage(pageH: number, margin: number): number {
  const firstRowY = margin + COST_FIRST_ROW_Y;
  const bottom = pageH - margin - COST_ROW_BOTTOM_MARGIN - COST_TOTAL_BLOCK_H;
  return Math.max(1, Math.floor((bottom - firstRowY) / COST_ROW_H) + 1);
}

/**
 * How many pages the cost breakdown occupies. Returns 0 when unpriced. Every
 * page has the same row capacity (each reserves total-block space), so the count
 * is a simple ceiling — and always matches the renderer, so no cost.line is ever
 * silently dropped.
 */
export function costPageCount(lineCount: number, hasPricing: boolean, pageH: number, margin: number): number {
  if (!hasPricing || lineCount === 0) return 0;
  return Math.ceil(lineCount / costRowsPerPage(pageH, margin));
}

/**
 * Draw the material-cost breakdown on its own page(s). Kept separate from the
 * panel table so it never perturbs summaryPageCount. Paginates so every
 * cost.line is rendered — a dropped row would make the breakdown fail to
 * reconcile with the grand total. Returns the number of pages drawn (0 when
 * unpriced). `firstPageNum` is the footer number of its first page.
 */
function drawCostPage(
  pdf: jsPDF,
  solution: Solution,
  stockSheets: StockSheet[],
  projectName: string,
  margin: number,
  pageW: number,
  pageH: number,
  firstPageNum: number,
  totalPages: number,
): number {
  const cost = computeCost(solution, stockSheets);
  if (!cost.hasPricing) return 0;

  const drawHeader = (): number => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Material Cost', margin, margin + COST_HEADER_TITLE_Y);

    let yy = margin + COST_HEADER_COLS_Y;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Sheet Type', margin + 0.02, yy);
    pdf.text('Sheets Used', margin + 4.0, yy);
    pdf.text('Price / Sheet', margin + 6.0, yy);
    pdf.text('Subtotal', pageW - margin, yy, { align: 'right' });
    yy += 0.08;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.005);
    pdf.line(margin, yy, pageW - margin, yy);
    yy += 0.28;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    return yy;
  };

  let pageIdx = 0;
  let y = drawHeader();

  // Every page reserves total-block space, so the grand total always fits below
  // the last row on its page — no row is dropped, and the count matches
  // costPageCount exactly (see the pagination test).
  const rowBottom = pageH - margin - COST_ROW_BOTTOM_MARGIN - COST_TOTAL_BLOCK_H;
  for (let i = 0; i < cost.lines.length; i++) {
    if (y > rowBottom) {
      drawPageFooter(pdf, projectName, firstPageNum + pageIdx, totalPages, pageW, pageH, margin);
      pdf.addPage();
      pageIdx++;
      y = drawHeader();
    }
    const line = cost.lines[i];
    pdf.text(line.label, margin + 0.02, y);
    pdf.text(String(line.sheetsUsed), margin + 4.0, y);
    pdf.text(line.pricePerSheet !== undefined ? formatCurrency(line.pricePerSheet) : '—', margin + 6.0, y);
    pdf.text(line.subtotal !== undefined ? formatCurrency(line.subtotal) : '—', pageW - margin, y, { align: 'right' });
    y += COST_ROW_H;
  }

  // Grand total (on the final cost page)
  y += 0.05;
  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.008);
  pdf.line(margin + 4.0, y, pageW - margin, y);
  y += 0.3;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Total', margin + 4.0, y);
  pdf.text(formatCurrency(cost.grandTotal), pageW - margin, y, { align: 'right' });

  if (cost.hasUnpriced) {
    y += 0.35;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Some sheets are unpriced — total is a partial estimate.', margin, y);
  }

  drawPageFooter(pdf, projectName, firstPageNum + pageIdx, totalPages, pageW, pageH, margin);
  return pageIdx + 1;
}

// ── Per-sheet pages: diagram (top) + cut list (bottom) ───────────────────────

function drawSheetPage(
  pdf: jsPDF,
  solution: Solution,
  sheetIndex: number,
  stockSheets: StockSheet[],
  margin: number,
  pageW: number,
  pageH: number,
  projectName: string,
  pageNum: number,
  totalPages: number,
  units: Units,
) {
  const sfx = unitSuffix(units);
  const fmt = (v: number) => formatDisplay(v, units);
  const sheet = solution.sheets[sheetIndex];
  const stockSheet = stockSheets.find((s) => s.id === sheet.stockSheetId);
  if (!stockSheet) return;

  const sheetW = stockSheet.length;
  const sheetH = stockSheet.width;

  // ── Header ──────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 30);
  const sheetTitle = `Sheet ${sheetIndex + 1}${stockSheet.label ? ' — ' + stockSheet.label : ''} (${fmt(sheetW)}${sfx} \u00d7 ${fmt(sheetH)}${sfx})`;
  pdf.text(sheetTitle, margin, margin + 0.3);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Waste: ${sheet.wastePercent.toFixed(1)}%`, pageW - margin, margin + 0.3, { align: 'right' });

  // ── Diagram (upper ~55% of usable vertical space) ────────────────────────
  const diagramTop = margin + 0.55;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const maxDiagramH = usableH * 0.54;
  const scale = Math.min((usableW - 0.3) / sheetW, maxDiagramH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const drawX = margin + (usableW - drawW) / 2;
  const drawY = diagramTop;

  // Dimension labels
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`${fmt(sheetW)}${sfx}`, drawX + drawW / 2, drawY - 0.1, { align: 'center' });
  pdf.text(`${fmt(sheetH)}${sfx}`, drawX - 0.15, drawY + drawH / 2, {
    align: 'center',
    angle: 90,
  });

  // Sheet outline
  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.012);
  pdf.rect(drawX, drawY, drawW, drawH);

  // Pieces
  sheet.placements.forEach((p, pi) => {
    const px = drawX + p.x * scale;
    const py = drawY + p.y * scale;
    const pw = p.width * scale;
    const ph = p.height * scale;

    // Color fill (desaturated/lightened for print)
    if (p.color && p.color.startsWith('#') && p.color.length === 7) {
      const [r, g, b] = hexToRgb(p.color);
      // Blend toward white at ~35% opacity equivalent
      const blend = (c: number) => Math.round(c * 0.38 + 255 * 0.62);
      pdf.setFillColor(blend(r), blend(g), blend(b));
    } else {
      pdf.setFillColor(220, 220, 220);
    }

    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.005);
    pdf.rect(px, py, pw, ph, 'FD');

    // Cut-list index number — top-left corner of piece
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(70, 70, 70);
    pdf.text(String(pi + 1), px + 0.04, py + 0.11);

    if (pw > 0.28 && ph > 0.2) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      const labelText = p.label || p.panelId.slice(0, 6);
      pdf.text(labelText, px + pw / 2, py + ph / 2 - 0.04, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.5);
      pdf.setTextColor(60, 60, 60);
      pdf.text(
        `${fmt(p.width)}${sfx} \u00d7 ${fmt(p.height)}${sfx}`,
        px + pw / 2,
        py + ph / 2 + 0.11,
        { align: 'center' }
      );
    }
  });

  // ── Cut list for this sheet (below diagram) ──────────────────────────────
  const cutListTop = drawY + drawH + 0.35;
  let y = cutListTop;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Cut List', margin, y);

  y += 0.22;
  pdf.setFontSize(7.5);
  pdf.setTextColor(110, 110, 110);
  pdf.text('#', margin, y);
  pdf.text('Panel', margin + 0.25, y);
  pdf.text('Length', margin + 2.8, y);
  pdf.text('Width', margin + 3.7, y);
  pdf.text('Rotated', margin + 4.6, y);

  y += 0.07;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.005);
  pdf.line(margin, y, pageW - margin, y);
  y += 0.18;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(40, 40, 40);

  sheet.placements.forEach((p, pi) => {
    if (y > pageH - margin - 0.2) return; // overflow guard
    pdf.text(String(pi + 1), margin, y);
    pdf.text(p.label || `—`, margin + 0.25, y);
    pdf.text(`${fmt(p.width)}${sfx}`, margin + 2.8, y);
    pdf.text(`${fmt(p.height)}${sfx}`, margin + 3.7, y);
    pdf.text(p.rotated ? 'Yes' : 'No', margin + 4.6, y);
    y += 0.22;
  });

  drawPageFooter(pdf, projectName, pageNum, totalPages, pageW, pageH, margin);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportSolutionAsPdf(
  solution: Solution,
  stockSheets: StockSheet[],
  projectName: string,
  panels: Panel[] = [],
  units: Units = 'imperial',
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
  const pageW = 11;
  const pageH = 8.5;
  const margin = 0.5;

  const summaryPages = summaryPageCount(panels.length, pageH, margin);
  const cost = computeCost(solution, stockSheets);
  const costPages = costPageCount(cost.lines.length, cost.hasPricing, pageH, margin);
  const totalPages = summaryPages + costPages + solution.sheets.length;

  // Pages 1..summaryPages: summary + (paginated) panels-needed table
  const usedSummaryPages = drawSummaryPage(
    pdf, solution, panels, projectName, margin, pageW, pageH, totalPages, units
  );
  drawPageFooter(pdf, projectName, usedSummaryPages, totalPages, pageW, pageH, margin);

  // Optional cost page(s), numbered right after the summary pages
  if (costPages > 0) {
    pdf.addPage();
    drawCostPage(
      pdf, solution, stockSheets, projectName, margin, pageW, pageH,
      summaryPages + 1, totalPages
    );
  }

  // Remaining pages: one per sheet, numbered after the summary (+ cost) pages
  const beforeSheets = summaryPages + costPages;
  for (let si = 0; si < solution.sheets.length; si++) {
    pdf.addPage();
    drawSheetPage(
      pdf, solution, si, stockSheets, margin, pageW, pageH,
      projectName, beforeSheets + si + 1, totalPages, units
    );
  }

  pdf.save(`${safeFilename(projectName, 'cut-planner')}.pdf`);
}
