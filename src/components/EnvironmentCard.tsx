
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnvironmentCardProps {
  title: string;
  description: string;
  config: {
    url: string;
    username: string;
    password: string;
  };
  onConfigChange: (config: any) => void;
  variant: 'live' | 'dev';
}

const EnvironmentCard = ({ title, description, config, onConfigChange, variant }: EnvironmentCardProps) => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  const handleInputChange = (field: string, value: string) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const handleTestConnection = async () => {
    if (!config.url || !config.username || !config.password) {
      return;
    }

    setIsConnecting(true);
    console.log(`Testing connection to ${variant} environment:`, { url: config.url, username: config.username });
    
    // Simulate connection test
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
    }, 2000);
  };

  const isConfigComplete = config.url && config.username && config.password;

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
          <Label htmlFor={`${variant}-url`}>WordPress URL</Label>
          <Input
            id={`${variant}-url`}
            placeholder="https://your-site.com"
            value={config.url}
            onChange={(e) => handleInputChange('url', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${variant}-username`}>Username</Label>
          <Input
            id={`${variant}-username`}
            placeholder="admin"
            value={config.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${variant}-password`}>Password</Label>
          <Input
            id={`${variant}-password`}
            type="password"
            placeholder="••••••••"
            value={config.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
        </div>

        <Button
          onClick={handleTestConnection}
          disabled={!isConfigComplete || isConnecting}
          className={cn(
            "w-full",
            variant === 'live' && "bg-red-600 hover:bg-red-700",
            variant === 'dev' && "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <Settings className="h-4 w-4 mr-2" />
          {isConnecting ? 'Testing Connection...' : 'Test Connection'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EnvironmentCard;
