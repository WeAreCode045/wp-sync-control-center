
<?php
/**
 * Plugin sync operations
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Plugin_Sync {
    
    public function sync_plugins($selected_plugins, $operation_type, $target_url, $target_credentials) {
        $results = array();
        
        foreach ($selected_plugins as $plugin_name) {
            try {
                if ($operation_type === 'push') {
                    $result = $this->push_plugin($plugin_name, $target_url, $target_credentials);
                } else {
                    $result = $this->pull_plugin($plugin_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'plugin' => $plugin_name,
                    'success' => true,
                    'message' => "Plugin {$plugin_name} synced successfully",
                );
            } catch (Exception $e) {
                $results[] = array(
                    'plugin' => $plugin_name,
                    'success' => false,
                    'message' => "Failed to sync plugin {$plugin_name}: " . $e->getMessage(),
                );
            }
        }
        
        return $results;
    }
    
    private function push_plugin($plugin_name, $target_url, $target_credentials) {
        $plugin_file = $this->find_plugin_file($plugin_name);
        if (!$plugin_file) {
            throw new Exception("Plugin file not found for {$plugin_name}");
        }
        
        $plugin_dir = dirname(WP_PLUGIN_DIR . '/' . $plugin_file);
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->create_zip_from_directory($plugin_dir, $file_handler->get_temp_filename($plugin_name . '_plugin'));
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        return $communicator->send_plugin_to_target($zip_file, $plugin_name, $target_url, $target_credentials);
    }
    
    private function pull_plugin($plugin_name, $target_url, $target_credentials) {
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $plugin_data = $communicator->request_plugin_from_target($plugin_name, $target_url, $target_credentials);
        return $this->install_plugin_from_data($plugin_data, $plugin_name);
    }
    
    public function find_plugin_file($plugin_name) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $plugins = get_plugins();
        foreach ($plugins as $plugin_file => $plugin_data) {
            if ($plugin_data['Name'] === $plugin_name) {
                return $plugin_file;
            }
        }
        return false;
    }
    
    public function install_plugin_from_data($plugin_data, $plugin_name) {
        $plugin_dir = WP_PLUGIN_DIR . '/' . sanitize_file_name($plugin_name);
        
        // Create plugin directory if it doesn't exist
        if (!is_dir($plugin_dir)) {
            wp_mkdir_p($plugin_dir);
        }
        
        // Extract zip data
        $zip_data = base64_decode($plugin_data['file_data']);
        $temp_file = sys_get_temp_dir() . '/' . $plugin_name . '.zip';
        file_put_contents($temp_file, $zip_data);
        
        // Extract to plugin directory
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->extract_zip_to_directory($temp_file, $plugin_dir);
        $file_handler->cleanup_temp_file($temp_file);
        
        return true;
    }
}
