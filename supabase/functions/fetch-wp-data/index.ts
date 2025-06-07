
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
  
  // Clean up application password by removing spaces
  const cleanPassword = password.replace(/\s+/g, '');
  console.log(`Attempting to connect to: ${baseUrl}`);
  console.log(`Username: ${username}`);
  console.log(`Password length: ${cleanPassword.length}`);
  
  // Create basic auth header with cleaned password
  const auth = btoa(`${username}:${cleanPassword}`);
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  try {
    // Test basic connectivity first
    console.log('Testing basic REST API connectivity...');
    const testResponse = await fetch(`${baseUrl}/wp-json/wp/v2`, {
      headers,
    });
    
    console.log(`Test response status: ${testResponse.status}`);
    if (!testResponse.ok) {
      const testText = await testResponse.text();
      console.log(`Test response body: ${testText}`);
      throw new Error(`WordPress REST API not accessible: ${testResponse.status} - ${testText}`);
    }

    // Fetch plugins
    console.log('Fetching plugins...');
    const pluginsResponse = await fetch(`${baseUrl}/wp-json/wp/v2/plugins`, {
      headers,
    });
    
    console.log(`Plugins response status: ${pluginsResponse.status}`);
    let plugins = [];
    if (pluginsResponse.ok) {
      const pluginsData = await pluginsResponse.json();
      console.log(`Plugins data received:`, pluginsData);
      plugins = pluginsData;
    } else {
      const pluginsError = await pluginsResponse.text();
      console.log(`Plugins error: ${pluginsError}`);
      
      // Try alternative endpoint for plugins
      console.log('Trying alternative plugins endpoint...');
      try {
        const altPluginsResponse = await fetch(`${baseUrl}/wp-json/wp/v2/plugins?status=all`, {
          headers,
        });
        if (altPluginsResponse.ok) {
          plugins = await altPluginsResponse.json();
          console.log(`Alternative plugins data:`, plugins);
        }
      } catch (altError) {
        console.log(`Alternative plugins endpoint failed:`, altError);
      }
    }

    // Fetch themes
    console.log('Fetching themes...');
    const themesResponse = await fetch(`${baseUrl}/wp-json/wp/v2/themes`, {
      headers,
    });
    
    console.log(`Themes response status: ${themesResponse.status}`);
    let themes = [];
    if (themesResponse.ok) {
      const themesData = await themesResponse.json();
      console.log(`Themes data received:`, themesData);
      themes = themesData;
    } else {
      const themesError = await themesResponse.text();
      console.log(`Themes error: ${themesError}`);
      
      // Try alternative endpoint for themes
      console.log('Trying alternative themes endpoint...');
      try {
        const altThemesResponse = await fetch(`${baseUrl}/wp-json/wp/v2/themes?status=all`, {
          headers,
        });
        if (altThemesResponse.ok) {
          themes = await altThemesResponse.json();
          console.log(`Alternative themes data:`, themes);
        }
      } catch (altError) {
        console.log(`Alternative themes endpoint failed:`, altError);
      }
    }

    // Try to get media count
    console.log('Fetching media count...');
    let mediaCount = 0;
    try {
      const mediaResponse = await fetch(`${baseUrl}/wp-json/wp/v2/media?per_page=1`, {
        headers,
      });
      if (mediaResponse.ok) {
        const totalHeader = mediaResponse.headers.get('X-WP-Total');
        mediaCount = totalHeader ? parseInt(totalHeader) : 0;
        console.log(`Media count: ${mediaCount}`);
      }
    } catch (mediaError) {
      console.log(`Media count fetch failed:`, mediaError);
    }

    // Mock database tables for now (would need custom endpoint or WP-CLI)
    const tables = [
      { name: 'wp_posts', rows: 150, size: '2.3 MB', engine: 'InnoDB' },
      { name: 'wp_users', rows: 25, size: '0.1 MB', engine: 'InnoDB' },
      { name: 'wp_options', rows: 450, size: '1.8 MB', engine: 'InnoDB' },
      { name: 'wp_postmeta', rows: 800, size: '4.2 MB', engine: 'InnoDB' },
      { name: 'wp_comments', rows: 300, size: '0.8 MB', engine: 'InnoDB' },
    ];

    const result = {
      plugins: plugins.map((plugin: any) => ({
        name: plugin.name || plugin.Name || 'Unknown Plugin',
        slug: plugin.plugin || plugin.slug || 'unknown',
        version: plugin.version || plugin.Version || '1.0.0',
        status: plugin.status || 'inactive',
        update_available: plugin.update_available || false,
        description: plugin.description?.rendered || plugin.Description || '',
      })),
      themes: themes.map((theme: any) => ({
        name: theme.name?.rendered || theme.name || theme.Name || 'Unknown Theme',
        slug: theme.stylesheet || theme.slug || 'unknown',
        version: theme.version || theme.Version || '1.0.0',
        status: theme.status || 'inactive',
        update_available: theme.update_available || false,
        description: theme.description?.rendered || theme.Description || '',
      })),
      tables,
      media_count: mediaCount,
    };

    console.log('Final result:', result);
    return result;
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
