
<?php
/**
 * REST API endpoints
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
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
        
        // Receiving endpoints for push operations
        register_rest_route('wp-sync-manager/v1', '/receive-plugin', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'receive_plugin'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-theme', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'receive_theme'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-table', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'receive_table'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/receive-media', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'receive_media'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        // Sending endpoints for pull operations
        register_rest_route('wp-sync-manager/v1', '/send-plugin', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'send_plugin'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-theme', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'send_theme'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-table', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'send_table'),
            'permission_callback' => array($this, 'check_sync_permissions'),
        ));
        
        register_rest_route('wp-sync-manager/v1', '/send-media', array(
            'methods' => array('POST', 'OPTIONS'),
            'callback' => array($this, 'send_media'),
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
    
    // Receiving endpoint handlers
    public function receive_plugin($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['plugin_name']) || !isset($params['file_data'])) {
            return new WP_Error('missing_params', 'Missing plugin data', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $result = $sync_manager->install_plugin_from_data($params, $params['plugin_name']);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Plugin installed successfully',
            ));
        } catch (Exception $e) {
            return new WP_Error('plugin_install_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_theme($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['theme_name']) || !isset($params['file_data'])) {
            return new WP_Error('missing_params', 'Missing theme data', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $result = $sync_manager->install_theme_from_data($params, $params['theme_name']);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Theme installed successfully',
            ));
        } catch (Exception $e) {
            return new WP_Error('theme_install_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_table($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['table_name']) || !isset($params['table_sql'])) {
            return new WP_Error('missing_params', 'Missing table data', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $result = $sync_manager->import_table_sql($params['table_sql'], $params['table_name']);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Table imported successfully',
            ));
        } catch (Exception $e) {
            return new WP_Error('table_import_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_media($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['file_data']) || !isset($params['db_data'])) {
            return new WP_Error('missing_params', 'Missing media data', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $result = $sync_manager->install_media_from_data($params);
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Media imported successfully',
                'count' => $result['count'],
            ));
        } catch (Exception $e) {
            return new WP_Error('media_import_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    // Sending endpoint handlers
    public function send_plugin($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['plugin_name'])) {
            return new WP_Error('missing_params', 'Missing plugin name', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $plugin_file = $sync_manager->find_plugin_file($params['plugin_name']);
            
            if (!$plugin_file) {
                return new WP_Error('plugin_not_found', 'Plugin not found', array('status' => 404));
            }
            
            $plugin_dir = dirname(WP_PLUGIN_DIR . '/' . $plugin_file);
            $zip_file = $sync_manager->create_plugin_zip($plugin_dir, $params['plugin_name']);
            
            $file_data = base64_encode(file_get_contents($zip_file));
            unlink($zip_file);
            
            return rest_ensure_response(array(
                'plugin_name' => $params['plugin_name'],
                'file_data' => $file_data,
            ));
        } catch (Exception $e) {
            return new WP_Error('plugin_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_theme($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['theme_name'])) {
            return new WP_Error('missing_params', 'Missing theme name', array('status' => 400));
        }
        
        try {
            $theme_dir = get_theme_root() . '/' . $params['theme_name'];
            if (!is_dir($theme_dir)) {
                return new WP_Error('theme_not_found', 'Theme not found', array('status' => 404));
            }
            
            $sync_manager = new WP_Sync_Manager_Sync();
            $zip_file = $sync_manager->create_theme_zip($theme_dir, $params['theme_name']);
            
            $file_data = base64_encode(file_get_contents($zip_file));
            unlink($zip_file);
            
            return rest_ensure_response(array(
                'theme_name' => $params['theme_name'],
                'file_data' => $file_data,
            ));
        } catch (Exception $e) {
            return new WP_Error('theme_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_table($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        $params = $request->get_json_params();
        
        if (!isset($params['table_name'])) {
            return new WP_Error('missing_params', 'Missing table name', array('status' => 400));
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $table_sql = $sync_manager->export_table_sql($params['table_name']);
            
            return rest_ensure_response(array(
                'table_name' => $params['table_name'],
                'table_sql' => $table_sql,
            ));
        } catch (Exception $e) {
            return new WP_Error('table_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_media($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $media_files = $sync_manager->get_media_files();
            $zip_file = $sync_manager->create_media_zip($media_files);
            $media_db_data = $sync_manager->export_media_database_entries();
            
            $file_data = base64_encode(file_get_contents($zip_file));
            unlink($zip_file);
            
            return rest_ensure_response(array(
                'file_data' => $file_data,
                'db_data' => $media_db_data,
            ));
        } catch (Exception $e) {
            return new WP_Error('media_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
}
