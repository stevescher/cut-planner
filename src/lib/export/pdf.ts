import jsPDF from 'jspdf';
import { Solution, StockSheet, Panel } from '@/lib/optimizer/types';
import { formatDimension } from '@/lib/fractions';

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
  pdf.text(projectName || 'Cutlist', margin, pageH - margin * 0.45);
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - margin * 0.45, { align: 'right' });
}

// ── Page 1: Project summary + panels needed ──────────────────────────────────

function drawSummaryPage(
  pdf: jsPDF,
  solution: Solution,
  panels: Panel[],
  projectName: string,
  margin: number,
  pageW: number,
) {
  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(30, 30, 30);
  pdf.text(projectName || 'Cutlist', margin, margin + 0.45);

  // Stats row
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  const stats = [
    `${solution.totalSheets} sheet${solution.totalSheets !== 1 ? 's' : ''}`,
    `${solution.totalWaste.toFixed(1)}% waste`,
    ...(solution.unplacedPanels.length > 0
      ? [`⚠ ${solution.unplacedPanels.length} unplaced`]
      : []),
  ].join('   ·   ');
  pdf.text(stats, margin, margin + 0.75);

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.008);
  pdf.line(margin, margin + 0.95, pageW - margin, margin + 0.95);

  // Panels needed heading
  let y = margin + 1.25;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Panels Needed', margin, y);

  // Column headers
  y += 0.3;
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text('Label', margin + 0.18, y);
  pdf.text('Length', margin + 2.5, y);
  pdf.text('Width', margin + 3.5, y);
  pdf.text('Qty', margin + 4.5, y);

  y += 0.08;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.005);
  pdf.line(margin, y, margin + 5.2, y);
  y += 0.22;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(40, 40, 40);

  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    pdf.text(p.label || `Panel ${i + 1}`, margin + 0.18, y);
    pdf.text(`${formatDimension(p.length)}"`, margin + 2.5, y);
    pdf.text(`${formatDimension(p.width)}"`, margin + 3.5, y);
    pdf.text(String(p.quantity), margin + 4.5, y);
    y += 0.27;
  }
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
) {
  const sheet = solution.sheets[sheetIndex];
  const stockSheet = stockSheets.find((s) => s.id === sheet.stockSheetId);
  if (!stockSheet) return;

  const sheetW = stockSheet.length;
  const sheetH = stockSheet.width;

  // ── Header ──────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 30);
  const sheetTitle = `Sheet ${sheetIndex + 1}${stockSheet.label ? ' — ' + stockSheet.label : ''} (${formatDimension(sheetW)}" × ${formatDimension(sheetH)}")`;
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
  pdf.text(`${formatDimension(sheetW)}"`, drawX + drawW / 2, drawY - 0.1, { align: 'center' });
  pdf.text(`${formatDimension(sheetH)}"`, drawX - 0.15, drawY + drawH / 2, {
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
        `${formatDimension(p.width)}" \u00d7 ${formatDimension(p.height)}"`,
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
    pdf.text(`${formatDimension(p.width)}"`, margin + 2.8, y);
    pdf.text(`${formatDimension(p.height)}"`, margin + 3.7, y);
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
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
  const pageW = 11;
  const pageH = 8.5;
  const margin = 0.5;

  const totalPages = 1 + solution.sheets.length;

  // Page 1: summary + panels needed
  drawSummaryPage(pdf, solution, panels, projectName, margin, pageW);
  drawPageFooter(pdf, projectName, 1, totalPages, pageW, pageH, margin);

  // Pages 2+: one per sheet
  for (let si = 0; si < solution.sheets.length; si++) {
    pdf.addPage();
    drawSheetPage(pdf, solution, si, stockSheets, margin, pageW, pageH, projectName, si + 2, totalPages);
  }

  pdf.save(`${projectName || 'cutlist'}.pdf`);
}
