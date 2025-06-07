
<?php
/**
 * REST API send operation handlers
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_Send_Handlers {
    
    public function send_plugin($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Sending plugin");
        
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
            $file_handler = new WP_Sync_Manager_File_Handler();
            $zip_file = $file_handler->create_zip_from_directory($plugin_dir, $file_handler->get_temp_filename($params['plugin_name'] . '_plugin'));
            
            $file_data = base64_encode(file_get_contents($zip_file));
            $file_handler->cleanup_temp_file($zip_file);
            
            return rest_ensure_response(array(
                'plugin_name' => $params['plugin_name'],
                'file_data' => $file_data,
            ));
        } catch (Exception $e) {
            error_log("WP Sync Manager REST API: Plugin export failed - " . $e->getMessage());
            return new WP_Error('plugin_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_theme($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Sending theme");
        
        $params = $request->get_json_params();
        
        if (!isset($params['theme_name'])) {
            return new WP_Error('missing_params', 'Missing theme name', array('status' => 400));
        }
        
        try {
            $theme_dir = get_theme_root() . '/' . $params['theme_name'];
            if (!is_dir($theme_dir)) {
                return new WP_Error('theme_not_found', 'Theme not found', array('status' => 404));
            }
            
            $file_handler = new WP_Sync_Manager_File_Handler();
            $zip_file = $file_handler->create_zip_from_directory($theme_dir, $file_handler->get_temp_filename($params['theme_name'] . '_theme'));
            
            $file_data = base64_encode(file_get_contents($zip_file));
            $file_handler->cleanup_temp_file($zip_file);
            
            return rest_ensure_response(array(
                'theme_name' => $params['theme_name'],
                'file_data' => $file_data,
            ));
        } catch (Exception $e) {
            error_log("WP Sync Manager REST API: Theme export failed - " . $e->getMessage());
            return new WP_Error('theme_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_table($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Sending table");
        
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
            error_log("WP Sync Manager REST API: Table export failed - " . $e->getMessage());
            return new WP_Error('table_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
    
    public function send_media($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 200);
        }
        
        error_log("WP Sync Manager REST API: Sending media");
        
        try {
            $sync_manager = new WP_Sync_Manager_Sync();
            $media_files = $sync_manager->get_media_files();
            
            $file_handler = new WP_Sync_Manager_File_Handler();
            $zip_file = $file_handler->get_temp_filename('media_files');
            
            $media_sync = new WP_Sync_Manager_Media_Sync();
            $media_sync->create_media_zip($media_files, $zip_file);
            
            $media_db_data = $sync_manager->export_media_database_entries();
            
            $file_data = base64_encode(file_get_contents($zip_file));
            $file_handler->cleanup_temp_file($zip_file);
            
            return rest_ensure_response(array(
                'file_data' => $file_data,
                'db_data' => $media_db_data,
            ));
        } catch (Exception $e) {
            error_log("WP Sync Manager REST API: Media export failed - " . $e->getMessage());
            return new WP_Error('media_export_failed', $e->getMessage(), array('status' => 500));
        }
    }
}
