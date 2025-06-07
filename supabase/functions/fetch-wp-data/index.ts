
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPressCredentials {
  url: string;
  username: string;
  password: string;
  db_host?: string;
  db_name?: string;
  db_user?: string;
  db_password?: string;
}

const fetchDatabaseTables = async (dbCredentials: {
  db_host: string;
  db_name: string;
  db_user: string;
  db_password: string;
}) => {
  let client;
  try {
    console.log('Attempting to connect to database...');
    console.log(`Host: ${dbCredentials.db_host}, Database: ${dbCredentials.db_name}, User: ${dbCredentials.db_user}`);
    
    // Try to parse port from host if included
    let hostname = dbCredentials.db_host;
    let port = 3306; // Default MySQL port
    
    if (hostname.includes(':')) {
      const parts = hostname.split(':');
      hostname = parts[0];
      port = parseInt(parts[1]) || 3306;
    }
    
    client = await new Client().connect({
      hostname: hostname,
      port: port,
      username: dbCredentials.db_user,
      password: dbCredentials.db_password,
      db: dbCredentials.db_name,
      timeout: 10000, // 10 second timeout
    });

    console.log('Connected to database successfully');

    // Query to get ALL WordPress table information (not just wp_ prefixed)
    const query = `
      SELECT 
        table_name,
        table_rows,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        engine,
        table_comment
      FROM information_schema.tables 
      WHERE table_schema = ? 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const result = await client.execute(query, [dbCredentials.db_name]);
    
    const tables = result.rows?.map((row: any) => ({
      name: row[0],
      rows: parseInt(row[1]) || 0,
      size: `${row[2] || 0} MB`,
      engine: row[3] || 'Unknown',
      comment: row[4] || ''
    })) || [];

    console.log(`Successfully fetched ${tables.length} database tables`);
    console.log('Tables found:', tables.map(t => t.name));
    return tables;

  } catch (error) {
    console.error('Database connection error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      errno: error.errno
    });
    
    // If it's a connection timeout or connection refused, provide helpful error info
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('Connection issue - this might be due to:');
      console.error('1. Incorrect host or port');
      console.error('2. Firewall blocking the connection');
      console.error('3. Database server not accepting remote connections');
      console.error('4. Incorrect credentials');
    }
    
    throw new Error(`Database connection failed: ${error.message}`);
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('Database connection closed');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
};

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

    // Fetch database tables (real data if credentials provided, otherwise try to get from WordPress API)
    let tables = [];
    let databaseConnectionSuccessful = false;
    
    if (credentials.db_host && credentials.db_name && credentials.db_user && credentials.db_password) {
      console.log('Attempting to fetch real database tables...');
      try {
        tables = await fetchDatabaseTables({
          db_host: credentials.db_host,
          db_name: credentials.db_name,
          db_user: credentials.db_user,
          db_password: credentials.db_password,
        });
        databaseConnectionSuccessful = true;
        console.log('Successfully fetched real database tables');
      } catch (dbError) {
        console.error('Failed to fetch database tables:', dbError.message);
        console.log('Will try to get table info from WordPress API or use estimated data');
      }
    }
    
    // If direct database connection failed, try to get table info from WordPress or provide estimated data
    if (!databaseConnectionSuccessful) {
      console.log('Using estimated table data based on WordPress installation');
      
      // Get post count from WordPress API to estimate table sizes
      let postCount = 0;
      try {
        const postsResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=1`, {
          headers,
        });
        if (postsResponse.ok) {
          const totalHeader = postsResponse.headers.get('X-WP-Total');
          postCount = totalHeader ? parseInt(totalHeader) : 0;
        }
      } catch (error) {
        console.log('Could not fetch post count, using default estimates');
      }
      
      // Get user count
      let userCount = 0;
      try {
        const usersResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users?per_page=1`, {
          headers,
        });
        if (usersResponse.ok) {
          const totalHeader = usersResponse.headers.get('X-WP-Total');
          userCount = totalHeader ? parseInt(totalHeader) : 0;
        }
      } catch (error) {
        console.log('Could not fetch user count, using default estimates');
      }
      
      // Provide more realistic estimated data based on actual counts
      tables = [
        { name: 'wp_posts', rows: postCount || 150, size: `${Math.max(2.3, (postCount || 150) * 0.015)} MB`, engine: 'InnoDB', comment: 'WordPress posts table' },
        { name: 'wp_users', rows: userCount || 25, size: `${Math.max(0.1, (userCount || 25) * 0.004)} MB`, engine: 'InnoDB', comment: 'WordPress users table' },
        { name: 'wp_options', rows: Math.max(450, postCount * 2), size: `${Math.max(1.8, postCount * 0.012)} MB`, engine: 'InnoDB', comment: 'WordPress options table' },
        { name: 'wp_postmeta', rows: Math.max(800, postCount * 3), size: `${Math.max(4.2, postCount * 0.025)} MB`, engine: 'InnoDB', comment: 'WordPress post metadata table' },
        { name: 'wp_comments', rows: Math.max(300, postCount * 2), size: `${Math.max(0.8, postCount * 0.005)} MB`, engine: 'InnoDB', comment: 'WordPress comments table' },
        { name: 'wp_commentmeta', rows: Math.max(50, postCount), size: '0.5 MB', engine: 'InnoDB', comment: 'WordPress comment metadata table' },
        { name: 'wp_terms', rows: 50, size: '0.2 MB', engine: 'InnoDB', comment: 'WordPress terms table' },
        { name: 'wp_term_taxonomy', rows: 50, size: '0.2 MB', engine: 'InnoDB', comment: 'WordPress term taxonomy table' },
        { name: 'wp_term_relationships', rows: Math.max(100, postCount), size: `${Math.max(0.3, postCount * 0.002)} MB`, engine: 'InnoDB', comment: 'WordPress term relationships table' },
        { name: 'wp_usermeta', rows: Math.max(150, userCount * 6), size: `${Math.max(0.5, userCount * 0.02)} MB`, engine: 'InnoDB', comment: 'WordPress user metadata table' },
      ];
      
      // Add plugin-specific tables if plugins are detected
      if (plugins.length > 0) {
        plugins.forEach(plugin => {
          if (plugin.slug && plugin.status === 'active') {
            // Add common plugin tables based on popular plugins
            if (plugin.slug.includes('elementor')) {
              tables.push({ name: 'wp_elementor_library', rows: 20, size: '0.5 MB', engine: 'InnoDB', comment: 'Elementor library table' });
            }
            if (plugin.slug.includes('woocommerce')) {
              tables.push(
                { name: 'wp_woocommerce_order_items', rows: 100, size: '1.0 MB', engine: 'InnoDB', comment: 'WooCommerce order items' },
                { name: 'wp_woocommerce_sessions', rows: 50, size: '0.3 MB', engine: 'InnoDB', comment: 'WooCommerce sessions' }
              );
            }
          }
        });
      }
      
      console.log(`Generated ${tables.length} estimated table entries`);
    }

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
      database_connection_successful: databaseConnectionSuccessful,
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
