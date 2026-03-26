import jsPDF from 'jspdf';
import { Solution, StockSheet } from '@/lib/optimizer/types';
import { formatDimension } from '@/lib/fractions';

export async function exportSolutionAsPdf(
  solution: Solution,
  stockSheets: StockSheet[],
  projectName: string
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
  const pageW = 11;
  const pageH = 8.5;
  const margin = 0.5;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  // Title page / summary
  pdf.setFontSize(20);
  pdf.text(projectName, margin, margin + 0.5);

  pdf.setFontSize(12);
  pdf.text(`Sheets used: ${solution.totalSheets}`, margin, margin + 1);
  pdf.text(`Total waste: ${solution.totalWaste.toFixed(1)}%`, margin, margin + 1.3);
  pdf.text(`Strategy: ${solution.strategyName}`, margin, margin + 1.6);

  // Cut list table
  pdf.setFontSize(10);
  let y = margin + 2.2;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Cut List', margin, y);
  y += 0.3;

  pdf.text('Sheet', margin, y);
  pdf.text('Panel', margin + 1, y);
  pdf.text('Width', margin + 3.5, y);
  pdf.text('Height', margin + 4.5, y);
  pdf.text('Rotated', margin + 5.5, y);
  y += 0.05;
  pdf.line(margin, y, pageW - margin, y);
  y += 0.2;

  pdf.setFont('helvetica', 'normal');
  for (let si = 0; si < solution.sheets.length; si++) {
    const sheet = solution.sheets[si];
    const stockSheet = stockSheets.find((s) => s.id === sheet.stockSheetId);
    const sheetLabel = stockSheet?.label || `Sheet ${si + 1}`;

    for (const p of sheet.placements) {
      if (y > pageH - margin - 0.3) {
        pdf.addPage();
        y = margin + 0.5;
      }
      pdf.text(sheetLabel, margin, y);
      pdf.text(p.label, margin + 1, y);
      pdf.text(formatDimension(p.width) + '"', margin + 3.5, y);
      pdf.text(formatDimension(p.height) + '"', margin + 4.5, y);
      pdf.text(p.rotated ? 'Yes' : 'No', margin + 5.5, y);
      y += 0.25;
    }
  }

  // Layout pages - one per sheet
  for (let si = 0; si < solution.sheets.length; si++) {
    pdf.addPage();
    const sheet = solution.sheets[si];
    const stockSheet = stockSheets.find((s) => s.id === sheet.stockSheetId);
    if (!stockSheet) continue;

    const sheetW = stockSheet.length;
    const sheetH = stockSheet.width;

    // Title
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      `Sheet ${si + 1}${stockSheet.label ? ' — ' + stockSheet.label : ''} (${formatDimension(sheetW)} x ${formatDimension(sheetH)})`,
      margin,
      margin + 0.3
    );
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Waste: ${sheet.wastePercent.toFixed(1)}%`, pageW - margin - 1, margin + 0.3);

    // Draw sheet
    const diagramTop = margin + 0.6;
    const maxDiagramW = usableW - 0.5;
    const maxDiagramH = usableH - 1.2;
    const scale = Math.min(maxDiagramW / sheetW, maxDiagramH / sheetH);
    const drawW = sheetW * scale;
    const drawH = sheetH * scale;
    const drawX = margin + (usableW - drawW) / 2;
    const drawY = diagramTop;

    // Sheet outline
    pdf.setDrawColor(180);
    pdf.setLineWidth(0.01);
    pdf.rect(drawX, drawY, drawW, drawH);

    // Pieces
    for (const p of sheet.placements) {
      const px = drawX + p.x * scale;
      const py = drawY + p.y * scale;
      const pw = p.width * scale;
      const ph = p.height * scale;

      pdf.setFillColor(220, 220, 220);
      pdf.setDrawColor(100);
      pdf.setLineWidth(0.005);
      pdf.rect(px, py, pw, ph, 'FD');

      // Label
      if (pw > 0.3 && ph > 0.2) {
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        const labelText = p.label || p.panelId.slice(0, 6);
        pdf.text(labelText, px + pw / 2, py + ph / 2 - 0.05, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.text(
          `${formatDimension(p.width)}" x ${formatDimension(p.height)}"`,
          px + pw / 2,
          py + ph / 2 + 0.12,
          { align: 'center' }
        );
      }
    }

    // Dimension labels
    pdf.setFontSize(8);
    pdf.setDrawColor(0);
    pdf.text(`${formatDimension(sheetW)}"`, drawX + drawW / 2, drawY - 0.1, { align: 'center' });
    pdf.text(`${formatDimension(sheetH)}"`, drawX - 0.15, drawY + drawH / 2, {
      align: 'center',
      angle: 90,
    });
  }

  pdf.save(`${projectName || 'cutlist'}.pdf`);
}
