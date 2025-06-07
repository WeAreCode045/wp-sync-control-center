
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut } from 'lucide-react';
import ProjectSelector from '@/components/ProjectSelector';
import EnvironmentCard from '@/components/EnvironmentCard';
import ActionCenter from '@/components/ActionCenter';
import ConflictResolver from '@/components/ConflictResolver';
import AuthForm from '@/components/AuthForm';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">WordPress Deployment Manager</h1>
            <p className="text-xl text-muted-foreground">
              Synchronize your WordPress environments with precision and control
            </p>
          </div>
          <Button onClick={signOut} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="space-y-6">
          <ProjectSelector
            projects={projects}
            currentProject={currentProject}
            onProjectSelect={setCurrentProject}
            onProjectCreate={async (name, description) => {
              await createProject(name, description);
            }}
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
