
<?php
/**
 * REST API endpoints
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_API {
    
    private $permissions_handler;
    private $sync_handlers;
    private $receive_handlers;
    private $send_handlers;
    
    public function __construct() {
        $this->permissions_handler = new WP_Sync_Manager_REST_Permissions();
        $this->sync_handlers = new WP_Sync_Manager_REST_Sync_Handlers();
        $this->receive_handlers = new WP_Sync_Manager_REST_Receive_Handlers();
        $this->send_handlers = new WP_Sync_Manager_REST_Send_Handlers();
        
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function register_rest_routes() {
        // Main sync endpoints
        register_rest_route('wp-sync-manager/v1', '/sync', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->sync_handlers, 'handle_sync_request'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/status', array(
            'methods' => array('GET', 'OPTIONS'),
            'callback' => array($this->sync_handlers, 'get_sync_status'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/data', array(
            'methods' => array('GET', 'OPTIONS'),
            'callback' => array($this->sync_handlers, 'get_wp_data'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        // Receiving endpoints for push operations
        register_rest_route('wp-sync-manager/v1', '/receive-plugin', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->receive_handlers, 'receive_plugin'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-theme', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->receive_handlers, 'receive_theme'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-table', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->receive_handlers, 'receive_table'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-media', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->receive_handlers, 'receive_media'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        // Sending endpoints for pull operations
        register_rest_route('wp-sync-manager/v1', '/send-plugin', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->send_handlers, 'send_plugin'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-theme', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->send_handlers, 'send_theme'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-table', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->send_handlers, 'send_table'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-media', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this->send_handlers, 'send_media'),
            'permission_callback' => array($this->permissions_handler, 'check_sync_permissions'),
        ));
    }
}
