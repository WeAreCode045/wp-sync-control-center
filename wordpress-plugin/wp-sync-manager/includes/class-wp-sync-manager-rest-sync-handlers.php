
<?php
/**
 * REST API sync operation handlers
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_Sync_Handlers {
    
    public function handle_sync_request($request) {
        // Handle OPTIONS requests
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Handling sync request");
        
        $params = $request->get_json_params();
        
        // Log received parameters for debugging
        error_log("WP Sync Manager REST API: Received parameters: " . print_r($params, true));
        
        if (!isset($params['operation_type']) || !isset($params['components'])) {
            error_log("WP Sync Manager REST API: Missing required parameters");
            return new WP_Error('missing_params', 'Missing required parameters: operation_type and components are required', array('status' => 400));
        }
        
        // Validate and sanitize URLs and credentials
        $target_url = isset($params['target_url']) ? trim($params['target_url']) : '';
        $target_credentials = isset($params['target_credentials']) ? $params['target_credentials'] : array();
        
        // Enhanced URL validation
        if (empty($target_url)) {
            error_log("WP Sync Manager REST API: Empty target_url provided");
            return new WP_Error('missing_target_url', 'Target URL is required for sync operations', array('status' => 400));
        }
        
        // Validate URL format
        if (!filter_var($target_url, FILTER_VALIDATE_URL)) {
            error_log("WP Sync Manager REST API: Invalid target_url format: " . $target_url);
            return new WP_Error('invalid_target_url', 'Invalid target URL format: ' . $target_url, array('status' => 400));
        }
        
        // Validate credentials
        if (empty($target_credentials['username']) || empty($target_credentials['password'])) {
            error_log("WP Sync Manager REST API: Missing target credentials");
            return new WP_Error('missing_credentials', 'Target credentials (username and password) are required', array('status' => 400));
        }
        
        error_log("WP Sync Manager REST API: Validated parameters - Operation: " . $params['operation_type'] . ", Target URL: " . $target_url);
        
        $sync_manager = new WP_Sync_Manager_Sync();
        
        try {
            $result = $sync_manager->execute_sync(
                sanitize_text_field($params['operation_type']),
                $params['components'],
                $target_url, // Don't sanitize URL here to avoid breaking it
                $target_credentials
            );
            
            error_log("WP Sync Manager REST API: Sync completed successfully");
            return rest_ensure_response($result);
        } catch (Exception $e) {
            error_log("WP Sync Manager REST API: Sync failed - " . $e->getMessage());
            return new WP_Error('sync_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function get_wp_data($request) {
        // Handle OPTIONS requests
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Getting WP data");
        
        $data_manager = new WP_Sync_Manager_Data();
        
        try {
            $data = $data_manager->get_all_data();
            return rest_ensure_response($data);
        } catch (Exception $e) {
            error_log("WP Sync Manager REST API: Data fetch failed - " . $e->getMessage());
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
