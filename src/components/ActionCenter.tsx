import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, ArrowLeft, Database, Upload, Download, RefreshCw, Info, ExternalLink } from 'lucide-react';
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
  const [lastDataFetch, setLastDataFetch] = React.useState<Date | null>(null);
  const [usePluginSync, setUsePluginSync] = React.useState(true);
  const [syncProgress, setSyncProgress] = React.useState<{
    step: string;
    progress: number;
    message: string;
  } | null>(null);

  const loadCachedData = async (environmentId: string, environmentType: 'live' | 'dev') => {
    try {
      console.log(`Loading cached data for ${environmentType} environment:`, environmentId);
      
      const { data, error } = await supabase
        .from('wp_environment_data')
        .select('data, fetched_at')
        .eq('environment_id', environmentId)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading cached data:', error);
        return;
      }

      if (data) {
        console.log(`Found cached data for ${environmentType}:`, data);
        setWpData(prev => ({
          ...prev,
          [environmentType]: data.data
        }));
        setLastDataFetch(new Date(data.fetched_at));
        
        toast({
          title: "Gecachte data geladen",
          description: `${environmentType} data geladen van ${new Date(data.fetched_at).toLocaleString()}`,
        });
      } else {
        console.log(`No cached data found for ${environmentType} environment`);
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  const saveCachedData = async (environmentId: string, data: WordPressData) => {
    try {
      console.log('Saving cached data for environment:', environmentId);
      
      await supabase
        .from('wp_environment_data')
        .delete()
        .eq('environment_id', environmentId);

      const { error } = await supabase
        .from('wp_environment_data')
        .insert({
          environment_id: environmentId,
          data: data,
          fetched_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving cached data:', error);
      } else {
        console.log('Cached data saved successfully');
        setLastDataFetch(new Date());
      }
    } catch (error) {
      console.error('Error saving cached data:', error);
    }
  };

  const fetchWordPressData = async (environment: 'live' | 'dev', forceRefresh: boolean = false) => {
    const config = environments[environment];
    if (!config) return;

    if (!forceRefresh && lastDataFetch && wpData[environment]) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastDataFetch > oneHourAgo) {
        toast({
          title: "Gecachte data gebruikt",
          description: `${environment} data is recent (${lastDataFetch.toLocaleString()}). Gebruik 'Force Refresh' voor nieuwe data.`,
        });
        return;
      }
    }

    setLoadingData(true);
    try {
      let data;
      
      if (usePluginSync) {
        // Use WordPress plugin API
        console.log(`Fetching WordPress data via plugin for ${environment}...`);
        const authHeader = btoa(`${config.username}:${config.password}`);
        
        const response = await fetch(`${config.url}/wp-json/wp-sync-manager/v1/data`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Plugin API error: ${response.status} ${response.statusText}`);
        }

        data = await response.json();
      } else {
        // Use legacy edge function
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

        const { data: edgeData, error } = await supabase.functions.invoke('fetch-wp-data', {
          body: { credentials }
        });

        if (error) throw error;
        data = edgeData;
      }
      
      setWpData(prev => ({
        ...prev,
        [environment]: data
      }));

      if (config.id) {
        await saveCachedData(config.id, data);
      }

      toast({
        title: "Data opgehaald",
        description: `Verse ${environment} WordPress data succesvol opgehaald en gecached`,
      });
    } catch (error: any) {
      console.error('Error fetching WordPress data:', error);
      toast({
        title: "Fout",
        description: `Kon ${environment} data niet ophalen: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const getDataAge = () => {
    if (!lastDataFetch) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - lastDataFetch.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minuten geleden`;
    } else {
      return `${diffHours} uur geleden`;
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
    console.log('Starting pull operation with plugin sync:', selectedOptions);
    setIsProcessing(true);
    setSyncProgress({ step: 'initializing', progress: 0, message: 'Initialiseren sync...' });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

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

      const syncFunction = usePluginSync ? 'wordpress-plugin-sync' : 'wordpress-sync';
      
      const { data: syncResult, error: syncError } = await supabase.functions.invoke(syncFunction, {
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
              ? 'Sync succesvol voltooid!'
              : operation.status === 'failed'
              ? `Sync mislukt: ${operation.error_message}`
              : `Voortgang: ${operation.progress}%`
          });

          if (operation.status === 'completed' || operation.status === 'failed') {
            clearInterval(progressInterval);
            setIsProcessing(false);
            setSyncProgress(null);
            
            if (operation.status === 'completed') {
              toast({
                title: "Pull Voltooid",
                description: "Data succesvol overgetrokken van live naar development omgeving.",
              });
            } else {
              toast({
                title: "Pull Mislukt",
                description: operation.error_message || "Er is een fout opgetreden tijdens sync",
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
            description: "De sync operatie duurt langer dan verwacht. Controleer de logs.",
            variant: "destructive",
          });
        }
      }, 600000);

    } catch (error: any) {
      setIsProcessing(false);
      setSyncProgress(null);
      toast({
        title: "Pull Mislukt",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePush = async () => {
    console.log('Starting push operation with plugin sync:', selectedOptions);
    setIsProcessing(true);
    setSyncProgress({ step: 'initializing', progress: 0, message: 'Initialiseren push...' });
    
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

      if (selectedOptions.database.selected.length > 0) {
        setTimeout(async () => {
          const mockConflicts = {
            newRows: [
              { table: 'wp_posts', count: 5, description: 'Nieuwe blog posts in dev' },
              { table: 'wp_users', count: 2, description: 'Nieuwe gebruikersaccounts in dev' }
            ],
            updatedRows: [
              { table: 'wp_options', count: 3, description: 'Gewijzigde site instellingen' }
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
        const syncFunction = usePluginSync ? 'wordpress-plugin-sync' : 'wordpress-sync';
        
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(syncFunction, {
          body: {
            sourceEnv: environments.dev,
            targetEnv: environments.live,
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
                ? 'Push succesvol voltooid!'
                : operation.status === 'failed'
                ? `Push mislukt: ${operation.error_message}`
                : `Voortgang: ${operation.progress}%`
            });

            if (operation.status === 'completed' || operation.status === 'failed') {
              clearInterval(progressInterval);
              setIsProcessing(false);
              setSyncProgress(null);
              
              if (operation.status === 'completed') {
                toast({
                  title: "Push Voltooid",
                  description: "Data succesvol gepusht van development naar live omgeving.",
                });
              } else {
                toast({
                  title: "Push Mislukt",
                  description: operation.error_message || "Er is een fout opgetreden tijdens sync",
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
        title: "Push Mislukt",
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
      {/* Plugin Installation Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">WordPress Plugin Vereist</p>
            <p className="text-sm">
              Voor optimale sync functionaliteit, installeer de WP Sync Manager plugin op beide omgevingen.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Button variant="outline" size="sm" asChild>
                <a href="/wordpress-plugin/wp-sync-manager.zip" download className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Download Plugin
                </a>
              </Button>
              <span className="text-muted-foreground">Installeer op beide WordPress sites</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Selecteer Data om te Synchroniseren</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-plugin-sync"
                  checked={usePluginSync}
                  onCheckedChange={(checked) => setUsePluginSync(checked as boolean)}
                />
                <label htmlFor="use-plugin-sync" className="text-sm font-medium">
                  Gebruik Plugin Sync
                </label>
              </div>
              {lastDataFetch && (
                <span className="text-sm text-muted-foreground">
                  Data van {getDataAge()}
                </span>
              )}
              <Button
                onClick={() => fetchWordPressData('live', false)}
                disabled={!environments.live?.url || loadingData}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                Haal Live Data Op
              </Button>
              <Button
                onClick={() => fetchWordPressData('live', true)}
                disabled={!environments.live?.url || loadingData}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                Force Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            Kies welke componenten je wilt meenemen in je push/pull operatie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!wpData.live ? (
            <div className="text-center text-muted-foreground py-8">
              Klik op "Haal Live Data Op" om beschikbare plugins, themes en database tabellen te laden
            </div>
          ) : (
            <>
              {/* Plugins Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Plugins</h3>
                  <Badge variant="outline">{selectedOptions.plugins.selected.length} geselecteerd</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="plugins-all"
                    checked={selectedOptions.plugins.all}
                    onCheckedChange={(checked) => handleOptionChange('plugins', 'all', checked)}
                  />
                  <label htmlFor="plugins-all" className="text-sm font-medium">Selecteer alle plugins</label>
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
                  <Badge variant="outline">{selectedOptions.themes.selected.length} geselecteerd</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="themes-all"
                    checked={selectedOptions.themes.all}
                    onCheckedChange={(checked) => handleOptionChange('themes', 'all', checked)}
                  />
                  <label htmlFor="themes-all" className="text-sm font-medium">Selecteer alle themes</label>
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
                  <h3 className="text-sm font-medium">Database Tabellen</h3>
                  <Badge variant="outline">{selectedOptions.database.selected.length} geselecteerd</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="database-all"
                    checked={selectedOptions.database.all}
                    onCheckedChange={(checked) => handleOptionChange('database', 'all', checked)}
                  />
                  <label htmlFor="database-all" className="text-sm font-medium">Selecteer alle tabellen</label>
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
                  <label htmlFor="media" className="text-sm font-medium">Inclusief Media Bestanden</label>
                  {wpData.live?.media_count && (
                    <Badge variant="secondary">{wpData.live.media_count} bestanden</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Synchroniseer geüploade afbeeldingen, documenten en andere media bestanden
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
            <div className="font-semibold">Pull van Live</div>
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
            <div className="font-semibold">Push naar Live</div>
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
                {syncProgress.progress}% voltooid
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
              <span>Synchronisatie wordt verwerkt...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActionCenter;
