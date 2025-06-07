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
        
        error_log("WP Sync Manager REST API: Sending theme - START");
        
        $params = $request->get_json_params();
        
        if (!isset($params['theme_name'])) {
            error_log("WP Sync Manager REST API: Missing theme name parameter");
            return new WP_Error('missing_params', 'Missing theme name', array('status' => 400));
        }
        
        $theme_name = sanitize_text_field($params['theme_name']);
        error_log("WP Sync Manager REST API: Looking for theme: " . $theme_name);
        
        try {
            // First, get all available themes for debugging
            $all_themes = wp_get_themes();
            $theme_names = array_keys($all_themes);
            error_log("WP Sync Manager REST API: Available themes: " . implode(', ', $theme_names));
            
            // Try multiple methods to find the theme
            $theme = null;
            $theme_dir = null;
            
            // Method 1: Direct theme lookup by name
            $theme = wp_get_theme($theme_name);
            if ($theme->exists()) {
                $theme_dir = $theme->get_stylesheet_directory();
                error_log("WP Sync Manager REST API: Found theme via direct lookup: " . $theme_dir);
            } else {
                error_log("WP Sync Manager REST API: Direct lookup failed for: " . $theme_name);
                
                // Method 2: Try to find by display name
                foreach ($all_themes as $stylesheet => $theme_obj) {
                    if ($theme_obj->get('Name') === $theme_name) {
                        $theme = $theme_obj;
                        $theme_dir = $theme->get_stylesheet_directory();
                        error_log("WP Sync Manager REST API: Found theme by display name: " . $theme_dir);
                        break;
                    }
                }
                
                // Method 3: Try to find by partial name match
                if (!$theme) {
                    foreach ($all_themes as $stylesheet => $theme_obj) {
                        if (stripos($theme_obj->get('Name'), $theme_name) !== false || stripos($stylesheet, $theme_name) !== false) {
                            $theme = $theme_obj;
                            $theme_dir = $theme->get_stylesheet_directory();
                            error_log("WP Sync Manager REST API: Found theme by partial match: " . $theme_dir);
                            break;
                        }
                    }
                }
                
                // Method 4: Try folder-based approach
                if (!$theme) {
                    $theme_root = get_theme_root();
                    $possible_dirs = array(
                        $theme_root . '/' . $theme_name,
                        $theme_root . '/' . sanitize_title($theme_name),
                        $theme_root . '/' . strtolower(str_replace(' ', '-', $theme_name)),
                        $theme_root . '/' . strtolower(str_replace(' ', '', $theme_name))
                    );
                    
                    foreach ($possible_dirs as $dir) {
                        if (is_dir($dir)) {
                            $theme_dir = $dir;
                            $theme = wp_get_theme(basename($dir));
                            error_log("WP Sync Manager REST API: Found theme directory: " . $theme_dir);
                            break;
                        }
                    }
                }
            }
            
            if (!$theme || !$theme_dir || !is_dir($theme_dir)) {
                error_log("WP Sync Manager REST API: Theme not found after all methods: " . $theme_name);
                return new WP_Error('theme_not_found', "Theme '{$theme_name}' not found. Available themes: " . implode(', ', $theme_names), array('status' => 404));
            }
            
            if (!is_readable($theme_dir)) {
                error_log("WP Sync Manager REST API: Theme directory not readable: " . $theme_dir);
                return new WP_Error('theme_not_readable', "Theme directory is not readable", array('status' => 403));
            }
            
            error_log("WP Sync Manager REST API: Creating zip for theme directory: " . $theme_dir);
            
            $file_handler = new WP_Sync_Manager_File_Handler();
            $zip_file = $file_handler->create_zip_from_directory($theme_dir, $file_handler->get_temp_filename($theme_name . '_theme'));
            
            if (!file_exists($zip_file) || filesize($zip_file) === 0) {
                throw new Exception("Failed to create theme zip file or file is empty");
            }
            
            $file_data = base64_encode(file_get_contents($zip_file));
            $file_handler->cleanup_temp_file($zip_file);
            
            error_log("WP Sync Manager REST API: Successfully created theme zip for: " . $theme_name);
            
            return rest_ensure_response(array(
                'theme_name' => $theme_name,
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
            
            if (empty($media_files)) {
                error_log("WP Sync Manager REST API: No media files found");
                return rest_ensure_response(array(
                    'file_data' => '',
                    'db_data' => array('attachments' => array(), 'metadata' => array()),
                ));
            }
            
            $file_handler = new WP_Sync_Manager_File_Handler();
            $zip_file = $file_handler->get_temp_filename('media_files');
            
            $media_sync = new WP_Sync_Manager_Media_Sync();
            $media_sync->create_media_zip($media_files, $zip_file);
            
            if (!file_exists($zip_file) || filesize($zip_file) === 0) {
                throw new Exception("Failed to create media zip file or file is empty");
            }
            
            $media_db_data = $sync_manager->export_media_database_entries();
            
            $file_data = base64_encode(file_get_contents($zip_file));
            $file_handler->cleanup_temp_file($zip_file);
            
            error_log("WP Sync Manager REST API: Successfully created media zip with " . count($media_files) . " files");
            
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
