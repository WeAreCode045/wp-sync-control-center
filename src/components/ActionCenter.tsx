import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ArrowLeft, Database, Upload, Download, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Project, WPEnvironment, WordPressData } from '@/types/wordpress';

interface ActionCenterProps {
  currentProject: Project;
  environments: { live?: WPEnvironment; dev?: WPEnvironment };
  onConflictDetected: (conflicts: any) => void;
}

const ActionCenter = ({ currentProject, environments, onConflictDetected }: ActionCenterProps) => {
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = React.useState({
    plugins: { all: false, selected: [] as string[] },
    themes: { all: false, selected: [] as string[] },
    database: { all: false, selected: [] as string[] },
    media: false
  });

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [wpData, setWpData] = React.useState<{ live?: WordPressData; dev?: WordPressData }>({});
  const [loadingData, setLoadingData] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{
    step: string;
    progress: number;
    message: string;
  } | null>(null);

  const fetchWordPressData = async (environment: 'live' | 'dev') => {
    const config = environments[environment];
    if (!config) return;

    setLoadingData(true);
    try {
      const credentials = {
        url: config.url,
        username: config.username,
        password: config.password,
        ...(config.db_host && {
          db_host: config.db_host,
          db_name: config.db_name,
          db_user: config.db_user,
          db_password: config.db_password,
        })
      };

      const { data, error } = await supabase.functions.invoke('fetch-wp-data', {
        body: { credentials }
      });

      if (error) throw error;
      
      setWpData(prev => ({
        ...prev,
        [environment]: data
      }));

      toast({
        title: "Data fetched",
        description: `Successfully fetched ${environment} WordPress data`,
      });
    } catch (error: any) {
      console.error('Error fetching WordPress data:', error);
      toast({
        title: "Error",
        description: `Failed to fetch ${environment} data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const getAvailableItems = (type: 'plugins' | 'themes' | 'database') => {
    const liveData = wpData.live;
    if (!liveData) return [];

    switch (type) {
      case 'plugins':
        return liveData.plugins?.map(p => p.name) || [];
      case 'themes':
        return liveData.themes?.map(t => t.name) || [];
      case 'database':
        return liveData.tables?.map(t => t.name) || [];
      default:
        return [];
    }
  };

  const handleOptionChange = (category: string, type: 'all' | 'item', value: string | boolean) => {
    setSelectedOptions(prev => {
      const newOptions = { ...prev };
      const availableItems = getAvailableItems(category as 'plugins' | 'themes' | 'database');
      
      if (type === 'all') {
        newOptions[category].all = value as boolean;
        if (value) {
          newOptions[category].selected = availableItems;
        } else {
          newOptions[category].selected = [];
        }
      } else {
        const selected = [...newOptions[category].selected];
        if (selected.includes(value as string)) {
          newOptions[category].selected = selected.filter(item => item !== value);
        } else {
          newOptions[category].selected = [...selected, value as string];
        }
        newOptions[category].all = newOptions[category].selected.length === availableItems.length;
      }
      
      return newOptions;
    });
  };

  const handlePull = async () => {
    console.log('Starting real pull operation:', selectedOptions);
    setIsProcessing(true);
    setSyncProgress({ step: 'initializing', progress: 0, message: 'Initializing sync...' });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create sync operation record
      const { data: syncOp, error } = await supabase
        .from('sync_operations')
        .insert([{
          project_id: currentProject.id,
          operation_type: 'pull',
          source_environment: 'live',
          target_environment: 'dev',
          components: selectedOptions,
          status: 'running',
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Call the real sync function
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('wordpress-sync', {
        body: {
          sourceEnv: environments.live,
          targetEnv: environments.dev,
          components: selectedOptions,
          syncOperationId: syncOp.id
        }
      });

      if (syncError) throw syncError;

      // Poll for progress updates
      const progressInterval = setInterval(async () => {
        const { data: operation } = await supabase
          .from('sync_operations')
          .select('progress, status, error_message')
          .eq('id', syncOp.id)
          .single();

        if (operation) {
          setSyncProgress({
            step: operation.status,
            progress: operation.progress || 0,
            message: operation.status === 'completed' 
              ? 'Sync completed successfully!'
              : operation.status === 'failed'
              ? `Sync failed: ${operation.error_message}`
              : `Progress: ${operation.progress}%`
          });

          if (operation.status === 'completed' || operation.status === 'failed') {
            clearInterval(progressInterval);
            setIsProcessing(false);
            setSyncProgress(null);
            
            if (operation.status === 'completed') {
              toast({
                title: "Pull Complete",
                description: "Successfully pulled data from live to development environment.",
              });
            } else {
              toast({
                title: "Pull Failed",
                description: operation.error_message || "An error occurred during sync",
                variant: "destructive",
              });
            }
          }
        }
      }, 2000);

      // Set timeout to stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(progressInterval);
        if (isProcessing) {
          setIsProcessing(false);
          setSyncProgress(null);
          toast({
            title: "Sync Timeout",
            description: "The sync operation is taking longer than expected. Please check the logs.",
            variant: "destructive",
          });
        }
      }, 600000);

    } catch (error: any) {
      setIsProcessing(false);
      setSyncProgress(null);
      toast({
        title: "Pull Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePush = async () => {
    console.log('Starting real push operation:', selectedOptions);
    setIsProcessing(true);
    setSyncProgress({ step: 'initializing', progress: 0, message: 'Initializing push...' });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: syncOp, error } = await supabase
        .from('sync_operations')
        .insert([{
          project_id: currentProject.id,
          operation_type: 'push',
          source_environment: 'dev',
          target_environment: 'live',
          components: selectedOptions,
          status: 'running',
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Simulate conflict detection for database
      if (selectedOptions.database.selected.length > 0) {
        setTimeout(async () => {
          const mockConflicts = {
            newRows: [
              { table: 'wp_posts', count: 5, description: 'New blog posts in dev' },
              { table: 'wp_users', count: 2, description: 'New user accounts in dev' }
            ],
            updatedRows: [
              { table: 'wp_options', count: 3, description: 'Modified site settings' }
            ]
          };
          
          await supabase
            .from('sync_conflicts')
            .insert([{
              sync_operation_id: syncOp.id,
              conflict_type: 'new_rows',
              table_name: 'wp_posts',
              conflict_data: mockConflicts
            }]);
          
          setIsProcessing(false);
          setSyncProgress(null);
          onConflictDetected(mockConflicts);
        }, 2000);
      } else {
        // Call real sync function for push
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('wordpress-sync', {
          body: {
            sourceEnv: environments.dev,
            targetEnv: environments.live,
            components: selectedOptions,
            syncOperationId: syncOp.id
          }
        });

        if (syncError) throw syncError;

        // Same progress polling logic as pull
        const progressInterval = setInterval(async () => {
          const { data: operation } = await supabase
            .from('sync_operations')
            .select('progress, status, error_message')
            .eq('id', syncOp.id)
            .single();

          if (operation) {
            setSyncProgress({
              step: operation.status,
              progress: operation.progress || 0,
              message: operation.status === 'completed' 
                ? 'Push completed successfully!'
                : operation.status === 'failed'
                ? `Push failed: ${operation.error_message}`
                : `Progress: ${operation.progress}%`
            });

            if (operation.status === 'completed' || operation.status === 'failed') {
              clearInterval(progressInterval);
              setIsProcessing(false);
              setSyncProgress(null);
              
              if (operation.status === 'completed') {
                toast({
                  title: "Push Complete",
                  description: "Successfully pushed data from development to live environment.",
                });
              } else {
                toast({
                  title: "Push Failed",
                  description: operation.error_message || "An error occurred during sync",
                  variant: "destructive",
                });
              }
            }
          }
        }, 2000);

        setTimeout(() => {
          clearInterval(progressInterval);
          if (isProcessing) {
            setIsProcessing(false);
            setSyncProgress(null);
          }
        }, 600000);
      }
    } catch (error: any) {
      setIsProcessing(false);
      setSyncProgress(null);
      toast({
        title: "Push Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isConfigValid = environments.live?.url && environments.dev?.url;
  const hasSelections = selectedOptions.plugins.selected.length > 0 || 
                       selectedOptions.themes.selected.length > 0 || 
                       selectedOptions.database.selected.length > 0 || 
                       selectedOptions.media;

  const availablePlugins = getAvailableItems('plugins');
  const availableThemes = getAvailableItems('themes');
  const availableTables = getAvailableItems('database');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Select Data to Synchronize</CardTitle>
            </div>
            <Button
              onClick={() => fetchWordPressData('live')}
              disabled={!environments.live?.url || loadingData}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
              Fetch Live Data
            </Button>
          </div>
          <CardDescription>
            Choose which components to include in your push/pull operation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!wpData.live ? (
            <div className="text-center text-muted-foreground py-8">
              Click "Fetch Live Data" to load available plugins, themes, and database tables
            </div>
          ) : (
            <>
              {/* Plugins Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Plugins</h3>
                  <Badge variant="outline">{selectedOptions.plugins.selected.length} selected</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="plugins-all"
                    checked={selectedOptions.plugins.all}
                    onCheckedChange={(checked) => handleOptionChange('plugins', 'all', checked)}
                  />
                  <label htmlFor="plugins-all" className="text-sm font-medium">Select all plugins</label>
                </div>
                <div className="grid grid-cols-2 gap-2 ml-6">
                  {availablePlugins.map((plugin) => (
                    <div key={plugin} className="flex items-center space-x-2">
                      <Checkbox
                        id={`plugin-${plugin}`}
                        checked={selectedOptions.plugins.selected.includes(plugin)}
                        onCheckedChange={() => handleOptionChange('plugins', 'item', plugin)}
                      />
                      <label htmlFor={`plugin-${plugin}`} className="text-sm">{plugin}</label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Themes Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Themes</h3>
                  <Badge variant="outline">{selectedOptions.themes.selected.length} selected</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="themes-all"
                    checked={selectedOptions.themes.all}
                    onCheckedChange={(checked) => handleOptionChange('themes', 'all', checked)}
                  />
                  <label htmlFor="themes-all" className="text-sm font-medium">Select all themes</label>
                </div>
                <div className="grid grid-cols-2 gap-2 ml-6">
                  {availableThemes.map((theme) => (
                    <div key={theme} className="flex items-center space-x-2">
                      <Checkbox
                        id={`theme-${theme}`}
                        checked={selectedOptions.themes.selected.includes(theme)}
                        onCheckedChange={() => handleOptionChange('themes', 'item', theme)}
                      />
                      <label htmlFor={`theme-${theme}`} className="text-sm">{theme}</label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Database Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Database Tables</h3>
                  <Badge variant="outline">{selectedOptions.database.selected.length} selected</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="database-all"
                    checked={selectedOptions.database.all}
                    onCheckedChange={(checked) => handleOptionChange('database', 'all', checked)}
                  />
                  <label htmlFor="database-all" className="text-sm font-medium">Select all tables</label>
                </div>
                <div className="grid grid-cols-2 gap-2 ml-6">
                  {availableTables.map((table) => (
                    <div key={table} className="flex items-center space-x-2">
                      <Checkbox
                        id={`table-${table}`}
                        checked={selectedOptions.database.selected.includes(table)}
                        onCheckedChange={() => handleOptionChange('database', 'item', table)}
                      />
                      <label htmlFor={`table-${table}`} className="text-mono text-xs">{table}</label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Media Section */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="media"
                    checked={selectedOptions.media}
                    onCheckedChange={(checked) => setSelectedOptions(prev => ({ ...prev, media: checked as boolean }))}
                  />
                  <label htmlFor="media" className="text-sm font-medium">Include Media Files</label>
                  {wpData.live?.media_count && (
                    <Badge variant="secondary">{wpData.live.media_count} files</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Synchronize uploaded images, documents, and other media files
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Button
          onClick={handlePull}
          disabled={!isConfigValid || !hasSelections || isProcessing || !wpData.live}
          className="h-16 bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          <Download className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-semibold">Pull from Live</div>
            <div className="text-xs opacity-90">Live → Development</div>
          </div>
        </Button>

        <Button
          onClick={handlePush}
          disabled={!isConfigValid || !hasSelections || isProcessing || !wpData.live}
          className="h-16 bg-red-600 hover:bg-red-700"
          size="lg"
        >
          <Upload className="h-5 w-5 mr-2" />
          <div className="text-left">
            <div className="font-semibold">Push to Live</div>
            <div className="text-xs opacity-90">Development → Live</div>
          </div>
        </Button>
      </div>

      {syncProgress && (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="font-medium">{syncProgress.message}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${syncProgress.progress}%` }}
                ></div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {syncProgress.progress}% complete
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isProcessing && !syncProgress && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Processing synchronization...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActionCenter;
