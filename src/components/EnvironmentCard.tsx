
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WPEnvironment } from '@/types/wordpress';

interface EnvironmentCardProps {
  title: string;
  description: string;
  config: Partial<WPEnvironment> & { url: string; username: string; password: string; name: string };
  onConfigChange: (config: any) => void;
  variant: 'live' | 'dev';
}

const EnvironmentCard = ({ title, description, config, onConfigChange, variant }: EnvironmentCardProps) => {
  const [localConfig, setLocalConfig] = React.useState(config);
  const [isTesting, setIsTesting] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
  }, [config]);

  const handleInputChange = (field: string, value: string) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    await onConfigChange(localConfig);
    setHasChanges(false);
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
          <Label htmlFor={`${variant}-password`}>Password</Label>
          <Input
            id={`${variant}-password`}
            type="password"
            placeholder="••••••••"
            value={localConfig.password || ''}
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
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
