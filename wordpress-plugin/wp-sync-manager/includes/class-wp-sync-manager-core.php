
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
    
    private function load_includes() {
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-rest-api.php';
        require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-data.php';
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
        
        // Flush rewrite rules to ensure REST API endpoints work
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        // Deactivation tasks
        delete_option('wp_sync_manager_last_sync');
        flush_rewrite_rules();
    }
}
