
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Database, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WPEnvironment } from '@/types/wordpress';

interface EnvironmentCardProps {
  title: string;
  description: string;
  config: Partial<WPEnvironment> & { 
    url: string; 
    username: string; 
    password: string; 
    name: string;
    db_host?: string;
    db_name?: string;
    db_user?: string;
    db_password?: string;
  };
  onConfigChange: (config: any) => void;
  variant: 'live' | 'dev';
}

const EnvironmentCard = ({ title, description, config, onConfigChange, variant }: EnvironmentCardProps) => {
  const [localConfig, setLocalConfig] = React.useState(config);
  const [isTesting, setIsTesting] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [showDbSettings, setShowDbSettings] = React.useState(false);

  React.useEffect(() => {
    console.log('EnvironmentCard config updated:', config);
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const handleInputChange = (field: string, value: string) => {
    console.log(`Field "${field}" changed to:`, value);
    
    // Clean application password by removing spaces
    if (field === 'password') {
      value = value.replace(/\s+/g, '');
    }
    
    const newConfig = { ...localConfig, [field]: value };
    console.log('New local config:', newConfig);
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    console.log('=== SAVING CONFIG ===');
    console.log('Local config being saved:', localConfig);
    
    try {
      await onConfigChange(localConfig);
      setHasChanges(false);
      console.log('Config saved successfully');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!localConfig.url || !localConfig.username || !localConfig.password) {
      return;
    }

    setIsTesting(true);
    console.log(`Testing connection to ${variant} environment:`, { 
      url: localConfig.url, 
      username: localConfig.username 
    });
    
    // TODO: Implement real connection test via edge function
    setTimeout(() => {
      setIsTesting(false);
    }, 2000);
  };

  const isConfigComplete = localConfig.url && localConfig.username && localConfig.password;
  const isConnected = config.status === 'connected';

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
      variant === 'live' && "border-red-200 hover:border-red-300",
      variant === 'dev' && "border-blue-200 hover:border-blue-300"
    )}>
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        variant === 'live' && "bg-red-500",
        variant === 'dev' && "bg-blue-500"
      )} />
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={cn(
              "h-5 w-5",
              variant === 'live' && "text-red-600",
              variant === 'dev' && "text-blue-600"
            )} />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {isConnected && (
            <Badge variant="secondary" className={cn(
              variant === 'live' && "bg-red-100 text-red-800",
              variant === 'dev' && "bg-blue-100 text-blue-800"
            )}>
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${variant}-name`}>Environment Name</Label>
          <Input
            id={`${variant}-name`}
            placeholder="Live Site"
            value={localConfig.name || ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${variant}-url`}>WordPress URL</Label>
          <Input
            id={`${variant}-url`}
            placeholder="https://your-site.com"
            value={localConfig.url || ''}
            onChange={(e) => handleInputChange('url', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${variant}-username`}>Username</Label>
          <Input
            id={`${variant}-username`}
            placeholder="admin"
            value={localConfig.username || ''}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${variant}-password`}>Application Password</Label>
          <Input
            id={`${variant}-password`}
            type="password"
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            value={localConfig.password || ''}
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use a WordPress Application Password. Spaces will be automatically removed.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <Button
            onClick={() => setShowDbSettings(!showDbSettings)}
            variant="outline"
            className="w-full justify-between"
          >
            <span>Database Connection (Optional)</span>
            {showDbSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          {showDbSettings && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                For real database table information, provide your WordPress database credentials from wp-config.php
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${variant}-db-host`}>Database Host</Label>
                  <Input
                    id={`${variant}-db-host`}
                    placeholder="localhost"
                    value={localConfig.db_host || ''}
                    onChange={(e) => handleInputChange('db_host', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">DB_HOST</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${variant}-db-name`}>Database Name</Label>
                  <Input
                    id={`${variant}-db-name`}
                    placeholder="wp_database"
                    value={localConfig.db_name || ''}
                    onChange={(e) => handleInputChange('db_name', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">DB_NAME</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${variant}-db-user`}>Database User</Label>
                  <Input
                    id={`${variant}-db-user`}
                    placeholder="wp_user"
                    value={localConfig.db_user || ''}
                    onChange={(e) => handleInputChange('db_user', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">DB_USER</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${variant}-db-password`}>Database Password</Label>
                  <Input
                    id={`${variant}-db-password`}
                    type="password"
                    placeholder="database_password"
                    value={localConfig.db_password || ''}
                    onChange={(e) => handleInputChange('db_password', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">DB_PASSWORD</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {hasChanges && (
            <Button
              onClick={handleSaveConfig}
              className={cn(
                "flex-1",
                variant === 'live' && "bg-red-600 hover:bg-red-700",
                variant === 'dev' && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              Save Configuration
            </Button>
          )}
          
          <Button
            onClick={handleTestConnection}
            disabled={!isConfigComplete || isTesting}
            variant="outline"
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnvironmentCard;
