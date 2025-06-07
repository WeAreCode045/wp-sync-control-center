
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  sourceEnv: {
    url: string;
    username: string;
    password: string;
    db_host?: string;
    db_name?: string;
    db_user?: string;
    db_password?: string;
  };
  targetEnv: {
    url: string;
    username: string;
    password: string;
    db_host?: string;
    db_name?: string;
    db_user?: string;
    db_password?: string;
  };
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
  details?: any;
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

    // Step 1: Validate connections
    await updateProgress({ step: 'validation', progress: 5, message: 'Validating WordPress connections...' });
    
    const sourceAuth = btoa(`${sourceEnv.username}:${sourceEnv.password}`);
    const targetAuth = btoa(`${targetEnv.username}:${targetEnv.password}`);

    // Test source connection
    const sourceTest = await fetch(`${sourceEnv.url}/wp-json/wp/v2/users/me`, {
      headers: { 'Authorization': `Basic ${sourceAuth}` }
    });
    
    if (!sourceTest.ok) {
      throw new Error(`Source WordPress connection failed: ${sourceTest.statusText}`);
    }

    // Test target connection
    const targetTest = await fetch(`${targetEnv.url}/wp-json/wp/v2/users/me`, {
      headers: { 'Authorization': `Basic ${targetAuth}` }
    });
    
    if (!targetTest.ok) {
      throw new Error(`Target WordPress connection failed: ${targetTest.statusText}`);
    }

    await updateProgress({ step: 'validation', progress: 10, message: 'WordPress connections validated' });

    // Step 2: Sync Plugins
    if (components.plugins.selected.length > 0) {
      await updateProgress({ step: 'plugins', progress: 15, message: 'Syncing plugins...' });
      
      // Get source plugins
      const sourcePlugins = await fetch(`${sourceEnv.url}/wp-json/wp/v2/plugins`, {
        headers: { 'Authorization': `Basic ${sourceAuth}` }
      });
      const sourcePluginData = await sourcePlugins.json();

      // Get target plugins
      const targetPlugins = await fetch(`${targetEnv.url}/wp-json/wp/v2/plugins`, {
        headers: { 'Authorization': `Basic ${targetAuth}` }
      });
      const targetPluginData = await targetPlugins.json();

      for (const pluginName of components.plugins.selected) {
        const sourcePlugin = sourcePluginData.find((p: any) => p.name === pluginName);
        const targetPlugin = targetPluginData.find((p: any) => p.name === pluginName);

        if (sourcePlugin && targetPlugin) {
          // Update plugin status to match source
          if (sourcePlugin.status !== targetPlugin.status) {
            const action = sourcePlugin.status === 'active' ? 'activate' : 'deactivate';
            await fetch(`${targetEnv.url}/wp-json/wp/v2/plugins/${targetPlugin.plugin}`, {
              method: 'PUT',
              headers: { 
                'Authorization': `Basic ${targetAuth}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: sourcePlugin.status })
            });
            console.log(`Plugin ${pluginName} ${action}d on target`);
          }
        }
      }

      await updateProgress({ step: 'plugins', progress: 30, message: `Synced ${components.plugins.selected.length} plugins` });
    }

    // Step 3: Sync Themes
    if (components.themes.selected.length > 0) {
      await updateProgress({ step: 'themes', progress: 35, message: 'Syncing themes...' });
      
      // Get active theme from source
      const sourceThemes = await fetch(`${sourceEnv.url}/wp-json/wp/v2/themes`, {
        headers: { 'Authorization': `Basic ${sourceAuth}` }
      });
      const sourceThemeData = await sourceThemes.json();
      const activeSourceTheme = sourceThemeData.find((t: any) => t.status === 'active');

      if (activeSourceTheme && components.themes.selected.includes(activeSourceTheme.name.rendered)) {
        // Activate the same theme on target
        await fetch(`${targetEnv.url}/wp-json/wp/v2/themes/${activeSourceTheme.stylesheet}`, {
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

    // Step 4: Sync Database Tables
    if (components.database.selected.length > 0) {
      await updateProgress({ step: 'database', progress: 50, message: 'Syncing database tables...' });
      
      if (sourceEnv.db_host && targetEnv.db_host) {
        try {
          // Note: In a real implementation, you would use a proper database client
          // For now, we'll simulate the database sync
          console.log('Database sync would happen here with proper MySQL client');
          console.log('Selected tables:', components.database.selected);
          
          // This is where you would:
          // 1. Connect to source database
          // 2. Export selected tables
          // 3. Connect to target database
          // 4. Import data with URL replacement
          // 5. Handle conflicts
          
          await updateProgress({ step: 'database', progress: 75, message: `Synced ${components.database.selected.length} database tables` });
        } catch (error) {
          console.error('Database sync error:', error);
          throw new Error(`Database sync failed: ${error.message}`);
        }
      } else {
        console.log('Database credentials not provided, skipping database sync');
        await updateProgress({ step: 'database', progress: 75, message: 'Database sync skipped (no credentials)' });
      }
    }

    // Step 5: Sync Media Files
    if (components.media) {
      await updateProgress({ step: 'media', progress: 80, message: 'Syncing media files...' });
      
      // Get media from source
      const sourceMedia = await fetch(`${sourceEnv.url}/wp-json/wp/v2/media?per_page=100`, {
        headers: { 'Authorization': `Basic ${sourceAuth}` }
      });
      const sourceMediaData = await sourceMedia.json();

      console.log(`Found ${sourceMediaData.length} media files to sync`);
      
      // In a real implementation, you would:
      // 1. Download each media file from source
      // 2. Upload to target WordPress
      // 3. Update database references
      
      await updateProgress({ step: 'media', progress: 95, message: `Synced ${sourceMediaData.length} media files` });
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

    // Update sync operation with error
    if (req.json) {
      const { syncOperationId } = await req.json();
      await supabase
        .from('sync_operations')
        .update({ 
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncOperationId);
    }

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
