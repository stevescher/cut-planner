'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { exportProjectToFile, importProjectFromFile } from '@/lib/project-io';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Upload, FilePlus, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function ProjectMenu() {
  const { projectName, setProjectName, getProjectData, loadProjectData, reset } =
    useProjectStore();

  const handleExport = () => {
    const data = getProjectData();
    exportProjectToFile(data);
  };

  const handleImport = async () => {
    const data = await importProjectFromFile();
    if (data) {
      loadProjectData(data);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="h-8 w-48 text-sm font-medium"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" />}
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1" />
          Project
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleExport}>
            <Save className="h-4 w-4 mr-2" />
            Save to File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Load from File
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={reset}>
            <FilePlus className="h-4 w-4 mr-2" />
            New Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
