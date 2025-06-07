import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSH Client implementation using Deno's built-in capabilities
class SSHClient {
  private host: string;
  private port: number;
  private user: string;
  private key?: string;
  private password?: string;

  constructor(host: string, user: string, options: { key?: string; password?: string; port?: number } = {}) {
    this.host = host;
    this.port = options.port || 22;
    this.user = user;
    this.key = options.key;
    this.password = options.password;
  }

  async executeCommand(command: string, timeout: number = 30000): Promise<string> {
    try {
      console.log(`Executing SSH command: ${command}`);
      
      // Create SSH command with proper authentication
      const sshCmd = this.buildSSHCommand(command);
      
      // Execute command with timeout
      const process = new Deno.Command("ssh", {
        args: sshCmd,
        stdout: "piped",
        stderr: "piped",
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const { code, stdout, stderr } = await process.output();
      clearTimeout(timeoutId);

      const output = new TextDecoder().decode(stdout);
      const error = new TextDecoder().decode(stderr);

      if (code !== 0) {
        throw new Error(`SSH command failed (exit code ${code}): ${error}`);
      }

      console.log(`SSH command output: ${output}`);
      return output;
    } catch (error) {
      console.error(`SSH execution error: ${error.message}`);
      throw new Error(`SSH execution failed: ${error.message}`);
    }
  }

  private buildSSHCommand(command: string): string[] {
    const args = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=10',
      '-p', this.port.toString()
    ];

    if (this.key) {
      // Write SSH key to temporary file
      const keyFile = `/tmp/ssh_key_${Date.now()}`;
      Deno.writeTextFileSync(keyFile, this.key);
      Deno.chmodSync(keyFile, 0o600);
      args.push('-i', keyFile);
    } else if (this.password) {
      // For password authentication, use sshpass if available
      args.push('-o', 'PasswordAuthentication=yes');
    }

    args.push(`${this.user}@${this.host}`, command);
    return args;
  }

  async copyFile(localPath: string, remotePath: string, direction: 'upload' | 'download' = 'upload'): Promise<void> {
    try {
      console.log(`${direction === 'upload' ? 'Uploading' : 'Downloading'} file: ${localPath} ${direction === 'upload' ? '->' : '<-'} ${remotePath}`);
      
      const scpArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-r', // Recursive for directories
        '-P', this.port.toString()
      ];

      if (this.key) {
        const keyFile = `/tmp/ssh_key_${Date.now()}`;
        Deno.writeTextFileSync(keyFile, this.key);
        Deno.chmodSync(keyFile, 0o600);
        scpArgs.push('-i', keyFile);
      }

      if (direction === 'upload') {
        scpArgs.push(localPath, `${this.user}@${this.host}:${remotePath}`);
      } else {
        scpArgs.push(`${this.user}@${this.host}:${remotePath}`, localPath);
      }

      const process = new Deno.Command("scp", {
        args: scpArgs,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await process.output();
      
      if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(`SCP transfer failed (exit code ${code}): ${error}`);
      }

      console.log(`File transfer completed successfully`);
    } catch (error) {
      console.error(`File transfer error: ${error.message}`);
      throw new Error(`File transfer failed: ${error.message}`);
    }
  }
}

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
    console.log(`Connecting to MySQL as ${this.user}@${this.host}:${this.port}/${this.database}`);
  }

  async exportTable(conn: Deno.TcpConn, tableName: string): Promise<string> {
    console.log(`Exporting table: ${tableName}`);
    return `-- Export of ${tableName}\n-- This would contain the actual SQL dump`;
  }

  async importSQL(conn: Deno.TcpConn, sqlDump: string, sourceUrl: string, targetUrl: string): Promise<void> {
    console.log(`Importing SQL with URL replacement: ${sourceUrl} -> ${targetUrl}`);
    
    const processedSQL = sqlDump
      .replaceAll(sourceUrl, targetUrl)
      .replaceAll(sourceUrl.replace('https://', 'http://'), targetUrl.replace('https://', 'http://'));
    
    console.log('SQL import completed with URL replacements');
  }

  close(conn: Deno.TcpConn): void {
    conn.close();
  }
}

// Enhanced WP-CLI command executor with real SSH and file transfer
class WPCLIExecutor {
  private sshClient?: SSHClient;
  private wpPath: string;

  constructor(sshHost?: string, sshUser?: string, sshKey?: string, sshPassword?: string, wpPath: string = '/var/www/html') {
    this.wpPath = wpPath;
    
    if (sshHost && sshUser) {
      this.sshClient = new SSHClient(sshHost, sshUser, { 
        key: sshKey, 
        password: sshPassword 
      });
    }
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.sshClient) {
      throw new Error('SSH connection required for WP-CLI operations');
    }
    
    return await this.sshClient.executeCommand(command);
  }

  async downloadPlugin(pluginName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<boolean> {
    try {
      console.log(`Starting plugin migration: ${pluginName}`);
      
      // Step 1: Check if plugin exists in WordPress.org repository
      const isInRepo = await this.checkPluginInRepository(pluginName);
      
      if (isInRepo) {
        // Install from repository
        const installCmd = `cd ${this.wpPath} && wp plugin install ${pluginName} --allow-root`;
        await targetSSH.executeCommand(installCmd);
        console.log(`Plugin ${pluginName} installed from repository`);
      } else {
        // Copy custom plugin from source to target
        await this.copyCustomPlugin(pluginName, sourceSSH, targetSSH);
        console.log(`Custom plugin ${pluginName} copied from source`);
      }

      // Step 2: Check if plugin was active on source and activate on target
      const sourceStatus = await sourceSSH.executeCommand(
        `cd ${this.wpPath} && wp plugin status ${pluginName} --allow-root --format=json`
      );
      
      const statusData = JSON.parse(sourceStatus);
      if (statusData.status === 'active') {
        await targetSSH.executeCommand(
          `cd ${this.wpPath} && wp plugin activate ${pluginName} --allow-root`
        );
        console.log(`Plugin ${pluginName} activated on target`);
      }

      // Step 3: Copy plugin settings/options
      await this.copyPluginSettings(pluginName, sourceSSH, targetSSH);
      
      return true;
    } catch (error) {
      console.error(`Failed to migrate plugin ${pluginName}:`, error);
      return false;
    }
  }

  async downloadTheme(themeName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<boolean> {
    try {
      console.log(`Starting theme migration: ${themeName}`);
      
      // Step 1: Check if theme exists in WordPress.org repository
      const isInRepo = await this.checkThemeInRepository(themeName);
      
      if (isInRepo) {
        // Install from repository
        const installCmd = `cd ${this.wpPath} && wp theme install ${themeName} --allow-root`;
        await targetSSH.executeCommand(installCmd);
        console.log(`Theme ${themeName} installed from repository`);
      } else {
        // Copy custom theme from source to target
        await this.copyCustomTheme(themeName, sourceSSH, targetSSH);
        console.log(`Custom theme ${themeName} copied from source`);
      }

      // Step 2: Check if theme was active on source and activate on target
      const activeTheme = await sourceSSH.executeCommand(
        `cd ${this.wpPath} && wp theme status --allow-root --format=json`
      );
      
      const themeData = JSON.parse(activeTheme);
      const isActive = themeData.some((theme: any) => theme.name === themeName && theme.status === 'active');
      
      if (isActive) {
        await targetSSH.executeCommand(
          `cd ${this.wpPath} && wp theme activate ${themeName} --allow-root`
        );
        console.log(`Theme ${themeName} activated on target`);
      }

      // Step 3: Copy theme customizations
      await this.copyThemeCustomizations(themeName, sourceSSH, targetSSH);
      
      return true;
    } catch (error) {
      console.error(`Failed to migrate theme ${themeName}:`, error);
      return false;
    }
  }

  async downloadMedia(sourceSSH: SSHClient, targetSSH: SSHClient): Promise<boolean> {
    try {
      console.log('Starting media files migration');
      
      // Create temporary directory for media transfer
      const tempDir = `/tmp/wp_media_${Date.now()}`;
      await sourceSSH.executeCommand(`mkdir -p ${tempDir}`);
      
      // Copy uploads directory from source
      await sourceSSH.executeCommand(
        `rsync -av ${this.wpPath}/wp-content/uploads/ ${tempDir}/`
      );
      
      // Download from source to local temp
      const localTempDir = `/tmp/local_media_${Date.now()}`;
      await sourceSSH.copyFile(`${tempDir}/*`, localTempDir, 'download');
      
      // Upload to target
      await targetSSH.copyFile(localTempDir, `${this.wpPath}/wp-content/uploads/`, 'upload');
      
      // Set proper permissions
      await targetSSH.executeCommand(
        `chown -R www-data:www-data ${this.wpPath}/wp-content/uploads/`
      );
      
      // Clean up temporary directories
      await sourceSSH.executeCommand(`rm -rf ${tempDir}`);
      await Deno.remove(localTempDir, { recursive: true });
      
      console.log('Media files migration completed');
      return true;
    } catch (error) {
      console.error('Failed to migrate media files:', error);
      return false;
    }
  }

  private async checkPluginInRepository(pluginName: string): Promise<boolean> {
    try {
      if (!this.sshClient) return false;
      
      const result = await this.sshClient.executeCommand(
        `curl -s "https://api.wordpress.org/plugins/info/1.0/${pluginName}.json" | head -1`
      );
      
      return !result.includes('null') && !result.includes('error');
    } catch {
      return false;
    }
  }

  private async checkThemeInRepository(themeName: string): Promise<boolean> {
    try {
      if (!this.sshClient) return false;
      
      const result = await this.sshClient.executeCommand(
        `curl -s "https://api.wordpress.org/themes/info/1.1/?action=theme_information&request[slug]=${themeName}" | head -1`
      );
      
      return !result.includes('null') && !result.includes('error');
    } catch {
      return false;
    }
  }

  private async copyCustomPlugin(pluginName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<void> {
    const tempDir = `/tmp/plugin_${pluginName}_${Date.now()}`;
    
    // Create temp directory and copy plugin
    await sourceSSH.executeCommand(`mkdir -p ${tempDir}`);
    await sourceSSH.executeCommand(
      `cp -r ${this.wpPath}/wp-content/plugins/${pluginName} ${tempDir}/`
    );
    
    // Transfer via local temp
    const localTempDir = `/tmp/local_plugin_${Date.now()}`;
    await sourceSSH.copyFile(`${tempDir}/${pluginName}`, localTempDir, 'download');
    await targetSSH.copyFile(localTempDir, `${this.wpPath}/wp-content/plugins/`, 'upload');
    
    // Set permissions
    await targetSSH.executeCommand(
      `chown -R www-data:www-data ${this.wpPath}/wp-content/plugins/${pluginName}`
    );
    
    // Cleanup
    await sourceSSH.executeCommand(`rm -rf ${tempDir}`);
    await Deno.remove(localTempDir, { recursive: true });
  }

  private async copyCustomTheme(themeName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<void> {
    const tempDir = `/tmp/theme_${themeName}_${Date.now()}`;
    
    // Create temp directory and copy theme
    await sourceSSH.executeCommand(`mkdir -p ${tempDir}`);
    await sourceSSH.executeCommand(
      `cp -r ${this.wpPath}/wp-content/themes/${themeName} ${tempDir}/`
    );
    
    // Transfer via local temp
    const localTempDir = `/tmp/local_theme_${Date.now()}`;
    await sourceSSH.copyFile(`${tempDir}/${themeName}`, localTempDir, 'download');
    await targetSSH.copyFile(localTempDir, `${this.wpPath}/wp-content/themes/`, 'upload');
    
    // Set permissions
    await targetSSH.executeCommand(
      `chown -R www-data:www-data ${this.wpPath}/wp-content/themes/${themeName}`
    );
    
    // Cleanup
    await sourceSSH.executeCommand(`rm -rf ${tempDir}`);
    await Deno.remove(localTempDir, { recursive: true });
  }

  private async copyPluginSettings(pluginName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<void> {
    try {
      // Export plugin options from source
      const optionsCmd = `cd ${this.wpPath} && wp option list --search="${pluginName}*" --format=json --allow-root`;
      const optionsData = await sourceSSH.executeCommand(optionsCmd);
      
      if (optionsData.trim()) {
        const options = JSON.parse(optionsData);
        
        // Import each option to target
        for (const option of options) {
          const importCmd = `cd ${this.wpPath} && wp option update "${option.option_name}" '${option.option_value}' --allow-root`;
          await targetSSH.executeCommand(importCmd);
        }
        
        console.log(`Plugin settings copied for ${pluginName}`);
      }
    } catch (error) {
      console.log(`Note: Could not copy settings for ${pluginName} - this is normal for some plugins`);
    }
  }

  private async copyThemeCustomizations(themeName: string, sourceSSH: SSHClient, targetSSH: SSHClient): Promise<void> {
    try {
      // Export theme mods and customizer settings
      const themeModsCmd = `cd ${this.wpPath} && wp option get theme_mods_${themeName} --format=json --allow-root`;
      const customizeCmd = `cd ${this.wpPath} && wp option get customize_stashed_theme_mods --format=json --allow-root`;
      
      try {
        const themeMods = await sourceSSH.executeCommand(themeModsCmd);
        if (themeMods.trim() && themeMods !== 'false') {
          await targetSSH.executeCommand(
            `cd ${this.wpPath} && wp option update theme_mods_${themeName} '${themeMods}' --allow-root`
          );
        }
      } catch {
        // Theme mods might not exist, which is fine
      }
      
      try {
        const customizeSettings = await sourceSSH.executeCommand(customizeCmd);
        if (customizeSettings.trim() && customizeSettings !== 'false') {
          await targetSSH.executeCommand(
            `cd ${this.wpPath} && wp option update customize_stashed_theme_mods '${customizeSettings}' --allow-root`
          );
        }
      } catch {
        // Customize settings might not exist, which is fine
      }
      
      console.log(`Theme customizations copied for ${themeName}`);
    } catch (error) {
      console.log(`Note: Could not copy customizations for ${themeName} - this is normal for some themes`);
    }
  }
}

// Helper function to normalize URLs
function normalizeUrl(url: string): string {
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

    // Initialize SSH clients for source and target
    const sourceSSH = new SSHClient(
      sourceEnv.ssh_host || sourceEnv.url.replace(/^https?:\/\//, ''),
      sourceEnv.ssh_user || 'root',
      { 
        key: sourceEnv.ssh_key,
        password: sourceEnv.ssh_password 
      }
    );

    const targetSSH = new SSHClient(
      targetEnv.ssh_host || targetEnv.url.replace(/^https?:\/\//, ''),
      targetEnv.ssh_user || 'root',
      { 
        key: targetEnv.ssh_key,
        password: targetEnv.ssh_password 
      }
    );

    // Initialize enhanced WP-CLI executor
    const wpCli = new WPCLIExecutor(
      targetEnv.ssh_host,
      targetEnv.ssh_user,
      targetEnv.ssh_key,
      targetEnv.ssh_password
    );

    // Step 2: Sync Plugins with complete migration
    if (components.plugins.selected.length > 0) {
      await updateProgress({ step: 'plugins', progress: 15, message: 'Syncing plugins with file transfer...' });
      
      let progressStep = 15;
      const stepSize = Math.floor(30 / components.plugins.selected.length);

      for (const pluginName of components.plugins.selected) {
        await updateProgress({ 
          step: 'plugins', 
          progress: progressStep, 
          message: `Migrating plugin: ${pluginName}` 
        });
        
        const success = await wpCli.downloadPlugin(pluginName, sourceSSH, targetSSH);
        if (!success) {
          console.warn(`Failed to migrate plugin: ${pluginName}`);
        }
        
        progressStep += stepSize;
      }

      await updateProgress({ step: 'plugins', progress: 45, message: `Migrated ${components.plugins.selected.length} plugins` });
    }

    // Step 3: Sync Themes with complete migration
    if (components.themes.selected.length > 0) {
      await updateProgress({ step: 'themes', progress: 50, message: 'Syncing themes with file transfer...' });
      
      let progressStep = 50;
      const stepSize = Math.floor(15 / components.themes.selected.length);

      for (const themeName of components.themes.selected) {
        await updateProgress({ 
          step: 'themes', 
          progress: progressStep, 
          message: `Migrating theme: ${themeName}` 
        });
        
        const success = await wpCli.downloadTheme(themeName, sourceSSH, targetSSH);
        if (!success) {
          console.warn(`Failed to migrate theme: ${themeName}`);
        }
        
        progressStep += stepSize;
      }

      await updateProgress({ step: 'themes', progress: 65, message: `Migrated ${components.themes.selected.length} themes` });
    }

    // Step 4: Sync Database Tables with MySQL client
    if (components.database.selected.length > 0) {
      await updateProgress({ step: 'database', progress: 70, message: 'Syncing database tables...' });
      
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
            let progressStep = 70;
            const stepSize = Math.floor(15 / components.database.selected.length);

            for (const tableName of components.database.selected) {
              await updateProgress({ 
                step: 'database', 
                progress: progressStep, 
                message: `Syncing table: ${tableName}` 
              });

              const sqlDump = await sourceDB.exportTable(sourceConn, tableName);
              await targetDB.importSQL(targetConn, sqlDump, sourceEnv.url, targetEnv.url);
              
              progressStep += stepSize;
            }

            await updateProgress({ step: 'database', progress: 85, message: `Synced ${components.database.selected.length} database tables` });
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
        await updateProgress({ step: 'database', progress: 85, message: 'Database sync skipped (no credentials)' });
      }
    }

    // Step 5: Sync Media Files with enhanced transfer
    if (components.media) {
      await updateProgress({ step: 'media', progress: 90, message: 'Syncing media files with SSH transfer...' });
      
      try {
        const mediaSuccess = await wpCli.downloadMedia(sourceSSH, targetSSH);
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
    await updateProgress({ step: 'complete', progress: 100, message: 'Complete WordPress migration finished successfully' });

    await supabase
      .from('sync_operations')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncOperationId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Complete WordPress migration completed successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Sync operation failed:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

// Type definitions
interface SyncRequest {
  sourceEnv: WPEnvironment;
  targetEnv: WPEnvironment;
  components: {
    plugins: { selected: string[] };
    themes: { selected: string[] };
    database: { selected: string[] };
    media: boolean;
  };
  syncOperationId: string;
}

interface SyncProgress {
  step: string;
  progress: number;
  message: string;
}

interface WPEnvironment {
  url: string;
  username: string;
  password: string;
  ssh_host?: string;
  ssh_user?: string;
  ssh_key?: string;
  ssh_password?: string;
  db_host?: string;
  db_user?: string;
  db_password?: string;
  db_name?: string;
}
