
<?php
/**
 * REST API endpoints and CORS handling
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('rest_api_init', array($this, 'add_cors_support'));
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
        
        $sync_manager = new WP_Sync_Manager_Sync();
        
        try {
            $result = $sync_manager->execute_sync(
                sanitize_text_field($params['operation_type']),
                $params['components'],
                isset($params['target_url']) ? esc_url_raw($params['target_url']) : '',
                isset($params['target_credentials']) ? $params['target_credentials'] : array()
            );
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
        
        $data_manager = new WP_Sync_Manager_Data();
        
        try {
            $data = $data_manager->get_all_data();
            return rest_ensure_response($data);
        } catch (Exception $e) {
            return new WP_Error('data_fetch_failed', $e->getMessage(), array('status' => 500));
        }
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
}
