
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPressCredentials {
  url: string;
  username: string;
  password: string;
}

const fetchWordPressData = async (credentials: WordPressCredentials) => {
  const { url, username, password } = credentials;
  const baseUrl = url.replace(/\/$/, '');
  
  // Create basic auth header
  const auth = btoa(`${username}:${password}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch plugins
    const pluginsResponse = await fetch(`${baseUrl}/wp-json/wp/v2/plugins`, {
      headers,
    });
    
    let plugins = [];
    if (pluginsResponse.ok) {
      plugins = await pluginsResponse.json();
    }

    // Fetch themes
    const themesResponse = await fetch(`${baseUrl}/wp-json/wp/v2/themes`, {
      headers,
    });
    
    let themes = [];
    if (themesResponse.ok) {
      themes = await themesResponse.json();
    }

    // For database tables and media, we'll need to implement custom endpoints
    // or use WP-CLI commands. For now, return mock data structure
    const tables = [
      { name: 'wp_posts', rows: 150, size: '2.3 MB', engine: 'InnoDB' },
      { name: 'wp_users', rows: 25, size: '0.1 MB', engine: 'InnoDB' },
      { name: 'wp_options', rows: 450, size: '1.8 MB', engine: 'InnoDB' },
      { name: 'wp_postmeta', rows: 800, size: '4.2 MB', engine: 'InnoDB' },
      { name: 'wp_comments', rows: 300, size: '0.8 MB', engine: 'InnoDB' },
    ];

    return {
      plugins: plugins.map((plugin: any) => ({
        name: plugin.name,
        slug: plugin.plugin,
        version: plugin.version,
        status: plugin.status,
        update_available: plugin.update_available || false,
        description: plugin.description?.rendered || '',
      })),
      themes: themes.map((theme: any) => ({
        name: theme.name?.rendered || theme.name,
        slug: theme.stylesheet,
        version: theme.version,
        status: theme.status || 'inactive',
        update_available: false,
        description: theme.description?.rendered || '',
      })),
      tables,
      media_count: 245, // This would need to be fetched from wp_posts where post_type='attachment'
    };
  } catch (error) {
    console.error('Error fetching WordPress data:', error);
    throw new Error(`Failed to connect to WordPress site: ${error.message}`);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credentials } = await req.json();

    if (!credentials || !credentials.url || !credentials.username || !credentials.password) {
      return new Response(
        JSON.stringify({ error: 'Missing required credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await fetchWordPressData(credentials);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-wp-data function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
