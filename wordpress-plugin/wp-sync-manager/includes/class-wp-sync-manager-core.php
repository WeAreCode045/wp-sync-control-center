<?php
/**
 * Core plugin functionality
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Core {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_loaded', array($this, 'handle_cors'), 1);
        add_action('send_headers', array($this, 'send_cors_headers'));
        
        register_activation_hook(WP_SYNC_MANAGER_PLUGIN_DIR . 'wp-sync-manager.php', array($this, 'activate'));
        register_deactivation_hook(WP_SYNC_MANAGER_PLUGIN_DIR . 'wp-sync-manager.php', array($this, 'deactivate'));
        
        // Load required classes
        $this->load_includes();
        
        // Initialize REST API
        new WP_Sync_Manager_REST_API();
        
        // Initialize admin if in admin area
        if (is_admin()) {
            new WP_Sync_Manager_Admin();
        }
    }
    
    public function handle_cors() {
        // Handle CORS for wp-sync-manager endpoints
        if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/wp-json/wp-sync-manager/') !== false) {
            $this->send_cors_headers();
            
            // Handle preflight OPTIONS requests
            if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
                status_header(200);
                exit;
            }
        }
    }
    
    public function send_cors_headers() {
        // Only add CORS headers for wp-sync-manager endpoints
        if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/wp-json/wp-sync-manager/') !== false) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, X-WP-Nonce');
            header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
            header('Access-Control-Max-Age: 86400');
        }
    }
    
    private function load_includes() {
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-rest-api.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-data.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-file-handler.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-ssh-handler.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-network-communicator.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-database-sync.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-plugin-sync.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-theme-sync.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-media-sync.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-sync.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-admin.php';
    }
    
    public function init() {
        // Load text domain for translations
        load_plugin_textdomain('wp-sync-manager', false, dirname(plugin_basename(WP_SYNC_MANAGER_PLUGIN_DIR . 'wp-sync-manager.php')) . '/languages');
    }
    
    public function activate() {
        // Activation tasks
        update_option('wp_sync_manager_version', WP_SYNC_MANAGER_VERSION);
        update_option('wp_sync_manager_activated', current_time('mysql'));
        
        // Create sync log table
        $this->create_sync_log_table();
        
        // Flush rewrite rules to ensure REST API endpoints work
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        // Deactivation tasks
        delete_option('wp_sync_manager_last_sync');
        flush_rewrite_rules();
    }
    
    private function create_sync_log_table() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'wp_sync_manager_log';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            operation_type varchar(20) NOT NULL,
            component_type varchar(20) NOT NULL,
            component_name varchar(255) NOT NULL,
            status varchar(20) NOT NULL,
            message text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
}
