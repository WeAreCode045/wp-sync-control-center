
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FolderOpen } from 'lucide-react';
import { Project } from '@/types/wordpress';

interface ProjectSelectorProps {
  projects: Project[];
  currentProject: Project | null;
  onProjectSelect: (project: Project) => void;
  onProjectCreate: (name: string, description?: string) => Promise<void>;
  loading: boolean;
}

const ProjectSelector = ({ 
  projects, 
  currentProject, 
  onProjectSelect, 
  onProjectCreate,
  loading 
}: ProjectSelectorProps) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setCreating(true);
    try {
      await onProjectCreate(newProjectName, newProjectDescription);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateDialog(false);
    } catch (error) {
      // Error handled in hook
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Project Selection
            </CardTitle>
            <CardDescription>
              Select or create a WordPress project to manage
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Create a new WordPress deployment project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="My WordPress Project"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (Optional)</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Project description..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleCreateProject} 
                  disabled={!newProjectName.trim() || creating}
                  className="w-full"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No projects found. Create your first project to get started.
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Select Project</Label>
            <Select
              value={currentProject?.id || ''}
              onValueChange={(value) => {
                const project = projects.find(p => p.id === value);
                if (project) onProjectSelect(project);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentProject && (
              <div className="text-sm text-muted-foreground">
                {currentProject.description || 'No description'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectSelector;
