
<?php
/**
 * Theme sync operations with hybrid SSH/REST approach
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Theme_Sync {
    
    private $ssh_handler;
    
    public function __construct() {
        $this->ssh_handler = new WP_Sync_Manager_SSH_Handler();
    }
    
    public function sync_themes($selected_themes, $operation_type, $target_url, $target_credentials) {
        error_log("WP Sync Manager Theme Sync: Starting theme sync - Operation: {$operation_type}, Target URL: {$target_url}");
        
        $results = array();
        
        foreach ($selected_themes as $theme_name) {
            try {
                error_log("WP Sync Manager Theme Sync: Processing theme: {$theme_name}");
                
                if ($operation_type === 'push') {
                    $result = $this->push_theme($theme_name, $target_url, $target_credentials);
                } else {
                    $result = $this->pull_theme($theme_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'theme' => $theme_name,
                    'success' => true,
                    'message' => "Theme {$theme_name} synced successfully via " . $result['method'],
                    'method' => $result['method']
                );
                
                error_log("WP Sync Manager Theme Sync: Successfully synced theme {$theme_name}");
            } catch (Exception $e) {
                error_log("WP Sync Manager Theme Sync: Failed to sync theme {$theme_name}: " . $e->getMessage());
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
        
        // Try SSH first, fallback to REST API
        if ($this->ssh_handler->test_ssh_connection($target_credentials)) {
            return $this->push_theme_via_ssh($theme_dir, $theme_name, $target_credentials);
        } else {
            return $this->push_theme_via_rest($theme_dir, $theme_name, $target_url, $target_credentials);
        }
    }
    
    private function pull_theme($theme_name, $target_url, $target_credentials) {
        error_log("WP Sync Manager Theme Sync: Pulling theme {$theme_name} from {$target_url}");
        
        $local_theme_dir = get_theme_root() . '/' . $theme_name;
        
        // Try SSH first, fallback to REST API
        if ($this->ssh_handler->test_ssh_connection($target_credentials)) {
            return $this->pull_theme_via_ssh($local_theme_dir, $theme_name, $target_credentials);
        } else {
            return $this->pull_theme_via_rest($theme_name, $target_url, $target_credentials);
        }
    }
    
    private function push_theme_via_ssh($theme_dir, $theme_name, $target_credentials) {
        $remote_wp_path = $this->ssh_handler->get_remote_wp_path($target_credentials);
        $remote_theme_dir = $remote_wp_path . '/wp-content/themes/' . basename($theme_dir);
        
        return $this->ssh_handler->sync_directory_via_ssh($theme_dir, $remote_theme_dir, $target_credentials, 'push');
    }
    
    private function pull_theme_via_ssh($local_theme_dir, $theme_name, $target_credentials) {
        $remote_wp_path = $this->ssh_handler->get_remote_wp_path($target_credentials);
        $remote_theme_dir = $remote_wp_path . '/wp-content/themes/' . basename($local_theme_dir);
        
        return $this->ssh_handler->sync_directory_via_ssh($local_theme_dir, $remote_theme_dir, $target_credentials, 'pull');
    }
    
    private function push_theme_via_rest($theme_dir, $theme_name, $target_url, $target_credentials) {
        error_log("WP Sync Manager Theme Sync: Pushing theme {$theme_name} via REST to {$target_url}");
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->create_zip_from_directory($theme_dir, $file_handler->get_temp_filename($theme_name . '_theme'));
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $result = $communicator->send_theme_to_target($zip_file, $theme_name, $target_url, $target_credentials);
        $result['method'] = 'rest_api';
        
        return $result;
    }
    
    private function pull_theme_via_rest($theme_name, $target_url, $target_credentials) {
        error_log("WP Sync Manager Theme Sync: Pulling theme {$theme_name} via REST from {$target_url}");
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $theme_data = $communicator->request_theme_from_target($theme_name, $target_url, $target_credentials);
        $result = $this->install_theme_from_data($theme_data, $theme_name);
        $result['method'] = 'rest_api';
        
        return $result;
    }
    
    public function install_theme_from_data($theme_data, $theme_name) {
        error_log("WP Sync Manager Theme Sync: Installing theme {$theme_name} from data");
        
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
        
        error_log("WP Sync Manager Theme Sync: Successfully installed theme {$theme_name}");
        
        return array('success' => true, 'method' => 'rest_api');
    }
}
