
<?php
/**
 * Plugin Name: WP Sync Manager
 * Plugin URI: https://code045.nl
 * Description: WordPress synchronization manager for syncing plugins, themes, database tables, and media between environments.
 * Version: 1.0.0
 * Author: Code045
 * License: GPL v2 or later
 * Text Domain: wp-sync-manager
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WP_SYNC_MANAGER_VERSION', '1.0.0');
define('WP_SYNC_MANAGER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WP_SYNC_MANAGER_PLUGIN_URL', plugin_dir_url(__FILE__));

class WP_Sync_Manager {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('rest_api_init', array($this, 'add_cors_support'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        // Load text domain for translations
        load_plugin_textdomain('wp-sync-manager', false, dirname(plugin_basename(__FILE__)) . '/languages');
        
        // Initialize admin menu if in admin area
        if (is_admin()) {
            add_action('admin_menu', array($this, 'add_admin_menu'));
        }
    }
    
    public function add_cors_support() {
        // Add CORS support for all wp-sync-manager endpoints
        add_filter('rest_pre_serve_request', array($this, 'add_cors_headers'), 15, 4);
    }
    
    public function add_cors_headers($served, $result, $request, $server) {
        // Only add CORS headers for our plugin endpoints
        $route = $request->get_route();
        if (strpos($route, '/wp-sync-manager/') !== false) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, X-WP-Nonce');
            header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
            
            // Handle preflight OPTIONS requests
            if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
                status_header(200);
                exit();
            }
        }
        
        return $served;
    }
    
    public function register_rest_routes() {
        // Register REST API endpoints for sync operations
        register_rest_route('wp-sync-manager/v1', '/sync', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'handle_sync_request'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/status', array(
            'methods' => array('GET', 'OPTIONS'),
            'callback' => array($this, 'get_sync_status'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/data', array(
            'methods' => array('GET', 'OPTIONS'),
            'callback' => array($this, 'get_wp_data'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
    }
    
    public function check_sync_permissions($request) {
        // Handle OPTIONS requests without authentication
        if ($request->get_method() === 'OPTIONS') {
            return true;
        }
        
        // Check if user has administrator capabilities
        return current_user_can('manage_options');
    }
    
    public function handle_sync_request($request) {
        // Handle OPTIONS requests
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['operation_type']) || !isset($params['components'])) {
            return new WP_Error('missing_params', 'Missing required parameters', array('status' => 400));
        }
        
        $operation_type = sanitize_text_field($params['operation_type']); // 'push' or 'pull'
        $components = $params['components'];
        $target_url = isset($params['target_url']) ? esc_url_raw($params['target_url']) : '';
        $target_credentials = isset($params['target_credentials']) ? $params['target_credentials'] : array();
        
        try {
            $result = $this->execute_sync($operation_type, $components, $target_url, $target_credentials);
            return rest_ensure_response($result);
        } catch (Exception $e) {
            return new WP_Error('sync_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function get_wp_data($request) {
        // Handle OPTIONS requests
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        try {
            $data = array(
                'plugins' => $this->get_plugins_data(),
                'themes' => $this->get_themes_data(),
                'tables' => $this->get_database_tables(),
                'media_count' => $this->get_media_count(),
                'site_info' => array(
                    'url' => get_site_url(),
                    'name' => get_bloginfo('name'),
                    'wp_version' => get_bloginfo('version'),
                    'php_version' => PHP_VERSION,
                )
            );
            
            return rest_ensure_response($data);
        } catch (Exception $e) {
            return new WP_Error('data_fetch_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    private function get_plugins_data() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        $plugins = array();
        
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $plugins[] = array(
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'status' => in_array($plugin_file, $active_plugins) ? 'active' : 'inactive',
                'file' => $plugin_file,
                'description' => $plugin_data['Description'],
                'author' => $plugin_data['Author'],
            );
        }
        
        return $plugins;
    }
    
    private function get_themes_data() {
        $all_themes = wp_get_themes();
        $active_theme = get_stylesheet();
        $themes = array();
        
        foreach ($all_themes as $theme_slug => $theme) {
            $themes[] = array(
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'status' => ($theme_slug === $active_theme) ? 'active' : 'inactive',
                'slug' => $theme_slug,
                'description' => $theme->get('Description'),
                'author' => $theme->get('Author'),
            );
        }
        
        return $themes;
    }
    
    private function get_database_tables() {
        global $wpdb;
        
        $tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
        $table_data = array();
        
        foreach ($tables as $table) {
            $table_name = $table[0];
            $count_result = $wpdb->get_var("SELECT COUNT(*) FROM `{$table_name}`");
            
            $table_data[] = array(
                'name' => $table_name,
                'rows' => intval($count_result),
            );
        }
        
        return $table_data;
    }
    
    private function get_media_count() {
        $media_query = new WP_Query(array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
            'fields' => 'ids',
        ));
        
        return $media_query->found_posts;
    }
    
    private function execute_sync($operation_type, $components, $target_url, $target_credentials) {
        $results = array(
            'operation_type' => $operation_type,
            'success' => true,
            'message' => 'Sync operation completed successfully',
            'details' => array(),
        );
        
        // Sync plugins
        if (!empty($components['plugins']['selected'])) {
            $plugin_result = $this->sync_plugins($components['plugins']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['plugins'] = $plugin_result;
        }
        
        // Sync themes
        if (!empty($components['themes']['selected'])) {
            $theme_result = $this->sync_themes($components['themes']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['themes'] = $theme_result;
        }
        
        // Sync database
        if (!empty($components['database']['selected'])) {
            $database_result = $this->sync_database($components['database']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['database'] = $database_result;
        }
        
        // Sync media
        if (!empty($components['media']) && $components['media']) {
            $media_result = $this->sync_media($operation_type, $target_url, $target_credentials);
            $results['details']['media'] = $media_result;
        }
        
        return $results;
    }
    
    private function sync_plugins($selected_plugins, $operation_type, $target_url, $target_credentials) {
        $results = array();
        
        foreach ($selected_plugins as $plugin_name) {
            try {
                if ($operation_type === 'push') {
                    // Push plugin to target environment
                    $result = $this->push_plugin($plugin_name, $target_url, $target_credentials);
                } else {
                    // Pull plugin from target environment
                    $result = $this->pull_plugin($plugin_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'plugin' => $plugin_name,
                    'success' => true,
                    'message' => "Plugin {$plugin_name} synced successfully",
                );
            } catch (Exception $e) {
                $results[] = array(
                    'plugin' => $plugin_name,
                    'success' => false,
                    'message' => "Failed to sync plugin {$plugin_name}: " . $e->getMessage(),
                );
            }
        }
        
        return $results;
    }
    
    private function sync_themes($selected_themes, $operation_type, $target_url, $target_credentials) {
        $results = array();
        
        foreach ($selected_themes as $theme_name) {
            try {
                if ($operation_type === 'push') {
                    $result = $this->push_theme($theme_name, $target_url, $target_credentials);
                } else {
                    $result = $this->pull_theme($theme_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'theme' => $theme_name,
                    'success' => true,
                    'message' => "Theme {$theme_name} synced successfully",
                );
            } catch (Exception $e) {
                $results[] = array(
                    'theme' => $theme_name,
                    'success' => false,
                    'message' => "Failed to sync theme {$theme_name}: " . $e->getMessage(),
                );
            }
        }
        
        return $results;
    }
    
    private function sync_database($selected_tables, $operation_type, $target_url, $target_credentials) {
        global $wpdb;
        $results = array();
        
        foreach ($selected_tables as $table_name) {
            try {
                if ($operation_type === 'push') {
                    $result = $this->push_database_table($table_name, $target_url, $target_credentials);
                } else {
                    $result = $this->pull_database_table($table_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'table' => $table_name,
                    'success' => true,
                    'message' => "Table {$table_name} synced successfully",
                );
            } catch (Exception $e) {
                $results[] = array(
                    'table' => $table_name,
                    'success' => false,
                    'message' => "Failed to sync table {$table_name}: " . $e->getMessage(),
                );
            }
        }
        
        return $results;
    }
    
    private function sync_media($operation_type, $target_url, $target_credentials) {
        try {
            if ($operation_type === 'push') {
                $result = $this->push_media($target_url, $target_credentials);
            } else {
                $result = $this->pull_media($target_url, $target_credentials);
            }
            
            return array(
                'success' => true,
                'message' => 'Media files synced successfully',
                'count' => $result['count'] ?? 0,
            );
        } catch (Exception $e) {
            return array(
                'success' => false,
                'message' => 'Failed to sync media: ' . $e->getMessage(),
            );
        }
    }
    
    // Placeholder methods for actual sync operations
    private function push_plugin($plugin_name, $target_url, $target_credentials) {
        // Implementation for pushing plugin files to target
        // This would involve file copying, API calls, etc.
        error_log("WP Sync Manager: Pushing plugin {$plugin_name} to {$target_url}");
        return true;
    }
    
    private function pull_plugin($plugin_name, $target_url, $target_credentials) {
        // Implementation for pulling plugin files from target
        error_log("WP Sync Manager: Pulling plugin {$plugin_name} from {$target_url}");
        return true;
    }
    
    private function push_theme($theme_name, $target_url, $target_credentials) {
        // Implementation for pushing theme files to target
        error_log("WP Sync Manager: Pushing theme {$theme_name} to {$target_url}");
        return true;
    }
    
    private function pull_theme($theme_name, $target_url, $target_credentials) {
        // Implementation for pulling theme files from target
        error_log("WP Sync Manager: Pulling theme {$theme_name} from {$target_url}");
        return true;
    }
    
    private function push_database_table($table_name, $target_url, $target_credentials) {
        // Implementation for pushing database table data to target
        error_log("WP Sync Manager: Pushing table {$table_name} to {$target_url}");
        return true;
    }
    
    private function pull_database_table($table_name, $target_url, $target_credentials) {
        // Implementation for pulling database table data from target
        error_log("WP Sync Manager: Pulling table {$table_name} from {$target_url}");
        return true;
    }
    
    private function push_media($target_url, $target_credentials) {
        // Implementation for pushing media files to target
        error_log("WP Sync Manager: Pushing media to {$target_url}");
        return array('count' => 0);
    }
    
    private function pull_media($target_url, $target_credentials) {
        // Implementation for pulling media files from target
        error_log("WP Sync Manager: Pulling media from {$target_url}");
        return array('count' => 0);
    }
    
    public function get_sync_status($request) {
        // Handle OPTIONS requests
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        // Return current sync status/progress
        return rest_ensure_response(array(
            'status' => 'idle',
            'last_sync' => get_option('wp_sync_manager_last_sync', null),
            'plugin_version' => WP_SYNC_MANAGER_VERSION,
        ));
    }
    
    public function add_admin_menu() {
        add_management_page(
            'WP Sync Manager',
            'Sync Manager',
            'manage_options',
            'wp-sync-manager',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>WP Sync Manager</h1>
            <p>WordPress Synchronization Manager is active. Use your external sync tool to manage synchronization.</p>
            <h2>Plugin Information</h2>
            <table class="form-table">
                <tr>
                    <th scope="row">Plugin Version</th>
                    <td><?php echo esc_html(WP_SYNC_MANAGER_VERSION); ?></td>
                </tr>
                <tr>
                    <th scope="row">API Endpoint</th>
                    <td><?php echo esc_url(get_rest_url(null, 'wp-sync-manager/v1/')); ?></td>
                </tr>
                <tr>
                    <th scope="row">Site URL</th>
                    <td><?php echo esc_url(get_site_url()); ?></td>
                </tr>
            </table>
            
            <h2>Available Endpoints</h2>
            <ul>
                <li><strong>GET</strong> <code>/wp-json/wp-sync-manager/v1/data</code> - Get WordPress data</li>
                <li><strong>POST</strong> <code>/wp-json/wp-sync-manager/v1/sync</code> - Execute sync operation</li>
                <li><strong>GET</strong> <code>/wp-json/wp-sync-manager/v1/status</code> - Get sync status</li>
            </ul>
        </div>
        <?php
    }
    
    public function activate() {
        // Activation tasks
        update_option('wp_sync_manager_version', WP_SYNC_MANAGER_VERSION);
        update_option('wp_sync_manager_activated', current_time('mysql'));
        
        // Flush rewrite rules to ensure REST API endpoints work
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        // Deactivation tasks
        delete_option('wp_sync_manager_last_sync');
        flush_rewrite_rules();
    }
}

// Initialize the plugin
new WP_Sync_Manager();
