
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EnvironmentCard from '@/components/EnvironmentCard';
import ActionCenter from '@/components/ActionCenter';
import ConflictResolver from '@/components/ConflictResolver';

const Index = () => {
  const [liveConfig, setLiveConfig] = React.useState({
    url: '',
    username: '',
    password: ''
  });

  const [devConfig, setDevConfig] = React.useState({
    url: '',
    username: '',
    password: ''
  });

  const [showConflictResolver, setShowConflictResolver] = React.useState(false);
  const [conflictData, setConflictData] = React.useState(null);

  const handleConflictDetected = (conflicts: any) => {
    setConflictData(conflicts);
    setShowConflictResolver(true);
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
                config={liveConfig}
                onConfigChange={setLiveConfig}
                variant="live"
              />
              <EnvironmentCard
                title="Development Environment"
                description="Staging WordPress installation"
                config={devConfig}
                onConfigChange={setDevConfig}
                variant="dev"
              />
            </div>
          </TabsContent>

          <TabsContent value="actions">
            <ActionCenter
              liveConfig={liveConfig}
              devConfig={devConfig}
              onConflictDetected={handleConflictDetected}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>
                  Recent push/pull operations and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">No recent activity</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
