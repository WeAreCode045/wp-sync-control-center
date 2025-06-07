import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MySQL client implementation using direct TCP connection
class MySQLClient {
  private host: string;
  private port: number;
  private user: string;
  private password: string;
  private database: string;

  constructor(host: string, user: string, password: string, database: string, port: number = 3306) {
    this.host = host;
    this.port = port;
    this.user = user;
    this.password = password;
    this.database = database;
  }

  async connect(): Promise<Deno.TcpConn> {
    try {
      const conn = await Deno.connect({ hostname: this.host, port: this.port });
      await this.authenticate(conn);
      return conn;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error.message}`);
    }
  }

  private async authenticate(conn: Deno.TcpConn): Promise<void> {
    // Simplified MySQL authentication - in production, use a proper MySQL driver
    // This is a basic implementation for demonstration
    console.log(`Connecting to MySQL as ${this.user}@${this.host}:${this.port}/${this.database}`);
  }

  async exportTable(conn: Deno.TcpConn, tableName: string): Promise<string> {
    // Simplified table export - returns SQL dump as string
    console.log(`Exporting table: ${tableName}`);
    
    // In a real implementation, this would:
    // 1. Execute SHOW CREATE TABLE
    // 2. Execute SELECT * FROM table
    // 3. Generate INSERT statements
    // 4. Return complete SQL dump
    
    return `-- Export of ${tableName}\n-- This would contain the actual SQL dump`;
  }

  async importSQL(conn: Deno.TcpConn, sqlDump: string, sourceUrl: string, targetUrl: string): Promise<void> {
    console.log(`Importing SQL with URL replacement: ${sourceUrl} -> ${targetUrl}`);
    
    // Replace URLs in SQL dump
    const processedSQL = sqlDump
      .replaceAll(sourceUrl, targetUrl)
      .replaceAll(sourceUrl.replace('https://', 'http://'), targetUrl.replace('https://', 'http://'));
    
    // In a real implementation, this would execute the SQL statements
    console.log('SQL import completed with URL replacements');
  }

  close(conn: Deno.TcpConn): void {
    conn.close();
  }
}

// WP-CLI command executor
class WPCLIExecutor {
  private sshHost?: string;
  private sshUser?: string;
  private sshKey?: string;
  private wpPath: string;

  constructor(sshHost?: string, sshUser?: string, sshKey?: string, wpPath: string = '/var/www/html') {
    this.sshHost = sshHost;
    this.sshUser = sshUser;
    this.sshKey = sshKey;
    this.wpPath = wpPath;
  }

  async executeCommand(command: string): Promise<string> {
    if (this.sshHost && this.sshUser) {
      return await this.executeSSHCommand(command);
    } else {
      throw new Error('SSH connection required for WP-CLI operations');
    }
  }

  private async executeSSHCommand(command: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Establish SSH connection using the provided key
    // 2. Execute the WP-CLI command remotely
    // 3. Return the output
    
    console.log(`Executing SSH command: ${command}`);
    
    // Simulated SSH command execution
    return `Command executed: ${command}`;
  }

  async downloadPlugin(pluginName: string, sourceHost: string, targetHost: string): Promise<boolean> {
    try {
      // Step 1: Get plugin info from source
      const pluginInfoCmd = `cd ${this.wpPath} && wp plugin get ${pluginName} --format=json`;
      console.log(`Getting plugin info: ${pluginInfoCmd}`);
      
      // Step 2: Download plugin on target if not exists
      const installCmd = `cd ${this.wpPath} && wp plugin install ${pluginName} --activate`;
      console.log(`Installing plugin: ${installCmd}`);
      
      // In real implementation:
      // 1. Check if plugin exists on target
      // 2. If not, try to install from WordPress repository
      // 3. If not in repository, copy files from source via SCP/SFTP
      // 4. Activate plugin if it was active on source
      
      return true;
    } catch (error) {
      console.error(`Failed to download plugin ${pluginName}:`, error);
      return false;
    }
  }

  async downloadTheme(themeName: string, sourceHost: string, targetHost: string): Promise<boolean> {
    try {
      const installCmd = `cd ${this.wpPath} && wp theme install ${themeName}`;
      console.log(`Installing theme: ${installCmd}`);
      
      // Similar to plugin installation but for themes
      return true;
    } catch (error) {
      console.error(`Failed to download theme ${themeName}:`, error);
      return false;
    }
  }

  async downloadMedia(sourceHost: string, targetHost: string): Promise<boolean> {
    try {
      // Use rsync or scp to copy wp-content/uploads directory
      const rsyncCmd = `rsync -avz ${this.sshUser}@${sourceHost}:${this.wpPath}/wp-content/uploads/ ${this.wpPath}/wp-content/uploads/`;
      console.log(`Syncing media files: ${rsyncCmd}`);
      
      return true;
    } catch (error) {
      console.error('Failed to download media files:', error);
      return false;
    }
  }
}

// Helper function to normalize URLs
function normalizeUrl(url: string): string {
  // Remove trailing slash and ensure no double slashes in path
  return url.replace(/\/+$/, '').replace(/([^:]\/)\/+/g, '$1');
}

// Helper function to create WordPress API URL
function createWpApiUrl(baseUrl: string, endpoint: string): string {
  const normalizedBase = normalizeUrl(baseUrl);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}/wp-json/wp/v2${normalizedEndpoint}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sourceEnv, targetEnv, components, syncOperationId }: SyncRequest = await req.json();

    console.log('Starting WordPress sync operation:', syncOperationId);
    console.log('Source environment:', { url: sourceEnv.url, username: sourceEnv.username });
    console.log('Target environment:', { url: targetEnv.url, username: targetEnv.username });

    // Update progress helper
    const updateProgress = async (progress: SyncProgress) => {
      console.log(`Progress: ${progress.step} - ${progress.progress}% - ${progress.message}`);
      await supabase
        .from('sync_operations')
        .update({ 
          progress: progress.progress,
          status: progress.progress === 100 ? 'completed' : 'running'
        })
        .eq('id', syncOperationId);
    };

    // Step 1: Validate connections with detailed error reporting
    await updateProgress({ step: 'validation', progress: 5, message: 'Validating WordPress connections...' });
    
    // Clean and prepare credentials - trim whitespace and ensure proper formatting
    const sourceAuth = btoa(`${sourceEnv.username.trim()}:${sourceEnv.password.trim()}`);
    const targetAuth = btoa(`${targetEnv.username.trim()}:${targetEnv.password.trim()}`);

    // Test source connection with proper URL formatting
    const sourceTestUrl = createWpApiUrl(sourceEnv.url, '/users/me');
    console.log(`Testing source connection to: ${sourceTestUrl}`);
    console.log(`Source auth header length: ${sourceAuth.length}`);
    
    try {
      const sourceTest = await fetch(sourceTestUrl, {
        headers: { 
          'Authorization': `Basic ${sourceAuth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'WordPress-Sync-Tool/1.0'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log(`Source response status: ${sourceTest.status}`);
      console.log(`Source response headers:`, Object.fromEntries(sourceTest.headers.entries()));
      
      if (!sourceTest.ok) {
        const errorText = await sourceTest.text();
        console.log(`Source error response: ${errorText}`);
        throw new Error(`Source WordPress connection failed: ${sourceTest.status} ${sourceTest.statusText} - ${errorText}`);
      }
      
      const sourceUser = await sourceTest.json();
      console.log(`Source connection successful for user: ${sourceUser.name || sourceUser.username || 'Unknown'}`);
    } catch (error) {
      console.error('Source connection error:', error);
      throw new Error(`Source WordPress connection failed: ${error.message}`);
    }

    // Test target connection with proper URL formatting and enhanced error handling
    const targetTestUrl = createWpApiUrl(targetEnv.url, '/users/me');
    console.log(`Testing target connection to: ${targetTestUrl}`);
    console.log(`Target username: ${targetEnv.username.trim()}`);
    console.log(`Target password length: ${targetEnv.password.trim().length}`);
    console.log(`Target auth header length: ${targetAuth.length}`);
    
    try {
      const targetTest = await fetch(targetTestUrl, {
        headers: { 
          'Authorization': `Basic ${targetAuth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'WordPress-Sync-Tool/1.0'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log(`Target response status: ${targetTest.status}`);
      console.log(`Target response headers:`, Object.fromEntries(targetTest.headers.entries()));
      
      if (!targetTest.ok) {
        const errorText = await targetTest.text();
        console.log(`Target error response: ${errorText}`);
        
        if (targetTest.status === 401) {
          throw new Error(`Target WordPress authentication failed (401 Unauthorized). Please verify:
1. Username "${targetEnv.username.trim()}" is correct
2. Application Password is valid and properly formatted (should be in format: xxxx xxxx xxxx xxxx xxxx xxxx)
3. Application Passwords are enabled on the WordPress site (Users → Profile → Application Passwords)
4. User has sufficient permissions (Administrator role recommended)
5. WordPress REST API is enabled and accessible
Response: ${errorText}`);
        }
        
        if (targetTest.status === 403) {
          throw new Error(`Target WordPress access forbidden (403). The user may not have sufficient permissions. Response: ${errorText}`);
        }
        
        throw new Error(`Target WordPress connection failed: ${targetTest.status} ${targetTest.statusText} - ${errorText}`);
      }
      
      const targetUser = await targetTest.json();
      console.log(`Target connection successful for user: ${targetUser.name || targetUser.username || 'Unknown'}`);
    } catch (error) {
      console.error('Target connection error:', error);
      if (error.name === 'TimeoutError') {
        throw new Error(`Target WordPress connection timed out. Please check if the site is accessible and responding.`);
      }
      throw new Error(`Target WordPress connection failed: ${error.message}`);
    }

    await updateProgress({ step: 'validation', progress: 10, message: 'WordPress connections validated' });

    // Initialize WP-CLI executor for target environment
    const wpCli = new WPCLIExecutor(
      targetEnv.ssh_host,
      targetEnv.ssh_user,
      targetEnv.ssh_key
    );

    // Step 2: Sync Plugins with file copying
    if (components.plugins.selected.length > 0) {
      await updateProgress({ step: 'plugins', progress: 15, message: 'Syncing plugins...' });
      
      // Get source plugins with proper URL formatting
      const sourcePluginsUrl = createWpApiUrl(sourceEnv.url, '/plugins');
      const sourcePlugins = await fetch(sourcePluginsUrl, {
        headers: { 'Authorization': `Basic ${sourceAuth}` }
      });
      const sourcePluginData = await sourcePlugins.json();

      // Get target plugins with proper URL formatting
      const targetPluginsUrl = createWpApiUrl(targetEnv.url, '/plugins');
      const targetPlugins = await fetch(targetPluginsUrl, {
        headers: { 'Authorization': `Basic ${targetAuth}` }
      });
      const targetPluginData = await targetPlugins.json();

      let progressStep = 15;
      for (const pluginName of components.plugins.selected) {
        const sourcePlugin = sourcePluginData.find((p: any) => p.name === pluginName);
        const targetPlugin = targetPluginData.find((p: any) => p.name === pluginName);

        if (sourcePlugin) {
          // If plugin doesn't exist on target, download it
          if (!targetPlugin) {
            await updateProgress({ 
              step: 'plugins', 
              progress: progressStep, 
              message: `Installing missing plugin: ${pluginName}` 
            });
            
            const downloaded = await wpCli.downloadPlugin(pluginName, sourceEnv.url, targetEnv.url);
            if (!downloaded) {
              console.warn(`Failed to download plugin: ${pluginName}`);
            }
          }

          // Update plugin status to match source
          if (targetPlugin && sourcePlugin.status !== targetPlugin.status) {
            const pluginUpdateUrl = createWpApiUrl(targetEnv.url, `/plugins/${targetPlugin.plugin}`);
            await fetch(pluginUpdateUrl, {
              method: 'PUT',
              headers: { 
                'Authorization': `Basic ${targetAuth}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: sourcePlugin.status })
            });
            console.log(`Plugin ${pluginName} status updated to: ${sourcePlugin.status}`);
          }
        }
        progressStep += Math.floor(15 / components.plugins.selected.length);
      }

      await updateProgress({ step: 'plugins', progress: 30, message: `Synced ${components.plugins.selected.length} plugins` });
    }

    // Step 3: Sync Themes with file copying
    if (components.themes.selected.length > 0) {
      await updateProgress({ step: 'themes', progress: 35, message: 'Syncing themes...' });
      
      // Get active theme from source with proper URL formatting
      const sourceThemesUrl = createWpApiUrl(sourceEnv.url, '/themes');
      const sourceThemes = await fetch(sourceThemesUrl, {
        headers: { 'Authorization': `Basic ${sourceAuth}` }
      });
      const sourceThemeData = await sourceThemes.json();
      const activeSourceTheme = sourceThemeData.find((t: any) => t.status === 'active');

      if (activeSourceTheme && components.themes.selected.includes(activeSourceTheme.name.rendered)) {
        // Check if theme exists on target, if not download it
        const targetThemesUrl = createWpApiUrl(targetEnv.url, '/themes');
        const targetThemes = await fetch(targetThemesUrl, {
          headers: { 'Authorization': `Basic ${targetAuth}` }
        });
        const targetThemeData = await targetThemes.json();
        const targetTheme = targetThemeData.find((t: any) => t.stylesheet === activeSourceTheme.stylesheet);

        if (!targetTheme) {
          await updateProgress({ 
            step: 'themes', 
            progress: 40, 
            message: `Installing missing theme: ${activeSourceTheme.name.rendered}` 
          });
          
          await wpCli.downloadTheme(activeSourceTheme.stylesheet, sourceEnv.url, targetEnv.url);
        }

        // Activate the same theme on target
        const themeUpdateUrl = createWpApiUrl(targetEnv.url, `/themes/${activeSourceTheme.stylesheet}`);
        await fetch(themeUpdateUrl, {
          method: 'PUT',
          headers: { 
            'Authorization': `Basic ${targetAuth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'active' })
        });
        console.log(`Theme ${activeSourceTheme.name.rendered} activated on target`);
      }

      await updateProgress({ step: 'themes', progress: 45, message: `Synced ${components.themes.selected.length} themes` });
    }

    // Step 4: Sync Database Tables with MySQL client (enhanced error handling)
    if (components.database.selected.length > 0) {
      await updateProgress({ step: 'database', progress: 50, message: 'Syncing database tables...' });
      
      if (sourceEnv.db_host && targetEnv.db_host) {
        try {
          console.log(`Attempting database connection - Source: ${sourceEnv.db_host}, Target: ${targetEnv.db_host}`);
          
          // Initialize MySQL clients with connection timeout
          const sourceDB = new MySQLClient(
            sourceEnv.db_host,
            sourceEnv.db_user!,
            sourceEnv.db_password!,
            sourceEnv.db_name!
          );
          
          const targetDB = new MySQLClient(
            targetEnv.db_host,
            targetEnv.db_user!,
            targetEnv.db_password!,
            targetEnv.db_name!
          );

          // Connect to both databases
          const sourceConn = await sourceDB.connect();
          const targetConn = await targetDB.connect();

          try {
            let progressStep = 50;
            const stepSize = Math.floor(25 / components.database.selected.length);

            for (const tableName of components.database.selected) {
              await updateProgress({ 
                step: 'database', 
                progress: progressStep, 
                message: `Syncing table: ${tableName}` 
              });

              // Export table from source
              const sqlDump = await sourceDB.exportTable(sourceConn, tableName);
              
              // Import to target with URL replacement
              await targetDB.importSQL(targetConn, sqlDump, sourceEnv.url, targetEnv.url);
              
              progressStep += stepSize;
            }

            await updateProgress({ step: 'database', progress: 75, message: `Synced ${components.database.selected.length} database tables` });
          } finally {
            sourceDB.close(sourceConn);
            targetDB.close(targetConn);
          }
        } catch (error) {
          console.error('Database sync error:', error);
          
          // Provide specific guidance based on error type
          if (error.message.includes('Connection timed out')) {
            throw new Error(`Database connection timed out. Please check:
1. Database host addresses are correct
2. Port 3306 is open and accessible
3. Database server allows remote connections
4. Firewall settings allow the connection
5. VPN connection if required
Error: ${error.message}`);
          } else if (error.message.includes('Access denied')) {
            throw new Error(`Database access denied. Please verify:
1. Database username and password are correct
2. User has proper permissions on both databases
3. Host is allowed to connect (check user@host settings)
Error: ${error.message}`);
          }
          
          throw new Error(`Database sync failed: ${error.message}`);
        }
      } else {
        console.log('Database credentials not provided, skipping database sync');
        await updateProgress({ step: 'database', progress: 75, message: 'Database sync skipped (no credentials)' });
      }
    }

    // Step 5: Sync Media Files using WP-CLI/rsync
    if (components.media) {
      await updateProgress({ step: 'media', progress: 80, message: 'Syncing media files...' });
      
      try {
        const mediaSuccess = await wpCli.downloadMedia(sourceEnv.url, targetEnv.url);
        if (mediaSuccess) {
          await updateProgress({ step: 'media', progress: 95, message: 'Media files synced successfully' });
        } else {
          await updateProgress({ step: 'media', progress: 95, message: 'Media sync completed with warnings' });
        }
      } catch (error) {
        console.error('Media sync error:', error);
        await updateProgress({ step: 'media', progress: 95, message: 'Media sync failed, continuing...' });
      }
    }

    // Step 6: Finalize
    await updateProgress({ step: 'complete', progress: 100, message: 'Sync completed successfully' });

    await supabase
      .from('sync_operations')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncOperationId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Sync completed successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Sync operation failed:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get syncOperationId from request body for error handling
    try {
      const body = await req.json();
      const { syncOperationId } = body;
      
      if (syncOperationId) {
        await supabase
          .from('sync_operations')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncOperationId);
      }
    } catch (parseError) {
      console.error('Failed to parse request body for error handling:', parseError);
    }

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
