
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ArrowLeft, Database, Upload, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ActionCenterProps {
  liveConfig: any;
  devConfig: any;
  onConflictDetected: (conflicts: any) => void;
}

const ActionCenter = ({ liveConfig, devConfig, onConflictDetected }: ActionCenterProps) => {
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = React.useState({
    plugins: { all: false, selected: [] as string[] },
    themes: { all: false, selected: [] as string[] },
    database: { all: false, selected: [] as string[] },
    media: false
  });

  const [isProcessing, setIsProcessing] = React.useState(false);

  const mockPlugins = ['Yoast SEO', 'WooCommerce', 'Contact Form 7', 'Akismet', 'Jetpack'];
  const mockThemes = ['Twenty Twenty-Four', 'Astra', 'Custom Theme'];
  const mockTables = ['wp_posts', 'wp_users', 'wp_options', 'wp_postmeta', 'wp_comments'];

  const handleOptionChange = (category: string, type: 'all' | 'item', value: string | boolean) => {
    setSelectedOptions(prev => {
      const newOptions = { ...prev };
      
      if (type === 'all') {
        newOptions[category].all = value as boolean;
        if (value) {
          newOptions[category].selected = category === 'plugins' ? mockPlugins : 
                                        category === 'themes' ? mockThemes : mockTables;
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
        newOptions[category].all = newOptions[category].selected.length === 
          (category === 'plugins' ? mockPlugins : category === 'themes' ? mockThemes : mockTables).length;
      }
      
      return newOptions;
    });
  };

  const handlePull = async () => {
    console.log('Pulling from live to dev:', selectedOptions);
    setIsProcessing(true);
    
    // Simulate the pull process
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Pull Complete",
        description: "Successfully pulled data from live to development environment.",
      });
    }, 3000);
  };

  const handlePush = async () => {
    console.log('Pushing from dev to live:', selectedOptions);
    setIsProcessing(true);
    
    // Simulate conflict detection for database
    if (selectedOptions.database.selected.length > 0) {
      setTimeout(() => {
        const mockConflicts = {
          newRows: [
            { table: 'wp_posts', count: 5, description: 'New blog posts in dev' },
            { table: 'wp_users', count: 2, description: 'New user accounts in dev' }
          ],
          updatedRows: [
            { table: 'wp_options', count: 3, description: 'Modified site settings' }
          ]
        };
        
        setIsProcessing(false);
        onConflictDetected(mockConflicts);
      }, 2000);
    } else {
      setTimeout(() => {
        setIsProcessing(false);
        toast({
          title: "Push Complete",
          description: "Successfully pushed data from development to live environment.",
        });
      }, 3000);
    }
  };

  const isConfigValid = liveConfig.url && devConfig.url;
  const hasSelections = selectedOptions.plugins.selected.length > 0 || 
                       selectedOptions.themes.selected.length > 0 || 
                       selectedOptions.database.selected.length > 0 || 
                       selectedOptions.media;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Select Data to Synchronize
          </CardTitle>
          <CardDescription>
            Choose which components to include in your push/pull operation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              {mockPlugins.map((plugin) => (
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
              {mockThemes.map((theme) => (
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
              {mockTables.map((table) => (
                <div key={table} className="flex items-center space-x-2">
                  <Checkbox
                    id={`table-${table}`}
                    checked={selectedOptions.database.selected.includes(table)}
                    onCheckedChange={() => handleOptionChange('database', 'item', table)}
                  />
                  <label htmlFor={`table-${table}`} className="text-sm font-mono text-xs">{table}</label>
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
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Synchronize uploaded images, documents, and other media files
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Button
          onClick={handlePull}
          disabled={!isConfigValid || !hasSelections || isProcessing}
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
          disabled={!isConfigValid || !hasSelections || isProcessing}
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

      {isProcessing && (
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
