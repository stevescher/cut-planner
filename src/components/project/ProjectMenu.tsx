'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useDragStore } from '@/store/useDragStore';
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

  // Loading or starting a new project must also drop the previous project's
  // computed solutions, undo history, and pins — or the viewer shows stale
  // layouts, undo jumps back into the old project's state, and index-keyed pins
  // (OPUS-402) can anchor pieces in the new project.
  const handleImport = async () => {
    const data = await importProjectFromFile();
    if (data) {
      loadProjectData(data);
      useLayoutStore.getState().reset();
      useHistoryStore.getState().clear();
      useDragStore.getState().clearPins();
    }
  };

  const handleNewProject = () => {
    reset();
    useLayoutStore.getState().reset();
    useHistoryStore.getState().clear();
    useDragStore.getState().clearPins();
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
          <DropdownMenuItem onClick={handleNewProject}>
            <FilePlus className="h-4 w-4 mr-2" />
            New Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
