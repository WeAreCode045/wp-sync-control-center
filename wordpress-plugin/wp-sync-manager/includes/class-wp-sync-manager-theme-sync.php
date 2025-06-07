
<?php
/**
 * Theme sync operations
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Theme_Sync {
    
    public function sync_themes($selected_themes, $operation_type, $target_url, $target_credentials) {
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
    
    private function push_theme($theme_name, $target_url, $target_credentials) {
        $theme_dir = get_theme_root() . '/' . $theme_name;
        if (!is_dir($theme_dir)) {
            throw new Exception("Theme directory not found for {$theme_name}");
        }
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->create_zip_from_directory($theme_dir, $file_handler->get_temp_filename($theme_name . '_theme'));
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        return $communicator->send_theme_to_target($zip_file, $theme_name, $target_url, $target_credentials);
    }
    
    private function pull_theme($theme_name, $target_url, $target_credentials) {
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $theme_data = $communicator->request_theme_from_target($theme_name, $target_url, $target_credentials);
        return $this->install_theme_from_data($theme_data, $theme_name);
    }
    
    public function install_theme_from_data($theme_data, $theme_name) {
        $theme_dir = get_theme_root() . '/' . sanitize_file_name($theme_name);
        
        if (!is_dir($theme_dir)) {
            wp_mkdir_p($theme_dir);
        }
        
        $zip_data = base64_decode($theme_data['file_data']);
        $temp_file = sys_get_temp_dir() . '/' . $theme_name . '.zip';
        file_put_contents($temp_file, $zip_data);
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->extract_zip_to_directory($temp_file, $theme_dir);
        $file_handler->cleanup_temp_file($temp_file);
        
        return true;
    }
}
