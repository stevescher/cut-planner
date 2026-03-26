'use client';

import { useLayoutStore } from '@/store/useLayoutStore';
import { useProjectStore } from '@/store/useProjectStore';
import { exportSolutionAsPdf } from '@/lib/export/pdf';
import { exportElementAsPng } from '@/lib/export/image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Image } from 'lucide-react';

export function ExportMenu() {
  const { solutions, activeSolutionIndex } = useLayoutStore();
  const { stockSheets, panels, projectName } = useProjectStore();

  const activeSolution = solutions[activeSolutionIndex];
  if (!activeSolution) return null;

  const handlePdfExport = async () => {
    await exportSolutionAsPdf(activeSolution, stockSheets, projectName, panels);
  };

  const handlePngExport = async () => {
    // Find the layout viewer main content area
    const layoutArea = document.querySelector('[data-export-target]') as HTMLElement;
    if (layoutArea) {
      await exportElementAsPng(layoutArea, `${projectName || 'cutlist'}.png`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handlePdfExport}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePngExport}>
          <Image className="h-4 w-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
