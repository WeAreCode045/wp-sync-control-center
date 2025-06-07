
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectSelector from '@/components/ProjectSelector';
import EnvironmentCard from '@/components/EnvironmentCard';
import ActionCenter from '@/components/ActionCenter';
import ConflictResolver from '@/components/ConflictResolver';
import { useProjects } from '@/hooks/useProjects';

const Index = () => {
  const {
    projects,
    currentProject,
    environments,
    loading,
    setCurrentProject,
    createProject,
    updateEnvironment
  } = useProjects();

  const [showConflictResolver, setShowConflictResolver] = React.useState(false);
  const [conflictData, setConflictData] = React.useState(null);

  const handleConflictDetected = (conflicts: any) => {
    setConflictData(conflicts);
    setShowConflictResolver(true);
  };

  const handleEnvironmentConfigChange = async (
    environmentType: 'live' | 'dev',
    config: any
  ) => {
    if (!currentProject) return;
    
    try {
      await updateEnvironment(currentProject.id, environmentType, config);
    } catch (error) {
      console.error('Failed to update environment:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">WordPress Deployment Manager</h1>
          <p className="text-xl text-muted-foreground">
            Synchronize your WordPress environments with precision and control
          </p>
        </div>

        <div className="space-y-6">
          <ProjectSelector
            projects={projects}
            currentProject={currentProject}
            onProjectSelect={setCurrentProject}
            onProjectCreate={createProject}
            loading={loading}
          />

          {currentProject && (
            <Tabs defaultValue="environments" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="environments">Environments</TabsTrigger>
                <TabsTrigger value="actions">Push/Pull Actions</TabsTrigger>
                <TabsTrigger value="history">Activity History</TabsTrigger>
              </TabsList>

              <TabsContent value="environments">
                <div className="grid md:grid-cols-2 gap-6">
                  <EnvironmentCard
                    title="Live Environment"
                    description="Production WordPress installation"
                    config={environments.live || { url: '', username: '', password: '', name: 'Live' }}
                    onConfigChange={(config) => handleEnvironmentConfigChange('live', config)}
                    variant="live"
                  />
                  <EnvironmentCard
                    title="Development Environment"
                    description="Staging WordPress installation"
                    config={environments.dev || { url: '', username: '', password: '', name: 'Development' }}
                    onConfigChange={(config) => handleEnvironmentConfigChange('dev', config)}
                    variant="dev"
                  />
                </div>
              </TabsContent>

              <TabsContent value="actions">
                <ActionCenter
                  currentProject={currentProject}
                  environments={environments}
                  onConflictDetected={handleConflictDetected}
                />
              </TabsContent>

              <TabsContent value="history">
                {/* History component will be implemented later */}
                <div className="text-center text-muted-foreground">
                  Activity history coming soon...
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {showConflictResolver && (
          <ConflictResolver
            conflicts={conflictData}
            onResolve={() => setShowConflictResolver(false)}
            onCancel={() => setShowConflictResolver(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
