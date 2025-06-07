
<?php
/**
 * REST API receive operation handlers
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_Receive_Handlers {
    
    public function receive_plugin($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Receiving plugin");
        
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
            error_log("WP Sync Manager REST API: Plugin install failed - " . $e->getMessage());
            return new WP_Error('plugin_install_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_theme($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Receiving theme");
        
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
            error_log("WP Sync Manager REST API: Theme install failed - " . $e->getMessage());
            return new WP_Error('theme_install_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_table($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Receiving table");
        
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
            error_log("WP Sync Manager REST API: Table import failed - " . $e->getMessage());
            return new WP_Error('table_import_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function receive_media($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Receiving media");
        
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
            error_log("WP Sync Manager REST API: Media import failed - " . $e->getMessage());
            return new WP_Error('media_import_failed', $e->getMessage(), array('status' => 500));
        }
    }
}
