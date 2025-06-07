<?php
/**
 * Plugin sync operations with hybrid SSH/REST approach
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Plugin_Sync {
    
    private $ssh_handler;
    
    public function __construct() {
        $this->ssh_handler = new WP_Sync_Manager_SSH_Handler();
    }
    
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
                    'message' => "Plugin {$plugin_name} synced successfully via " . $result['method'],
                    'method' => $result['method']
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
        
        // Try SSH first, fallback to REST API
        if ($this->ssh_handler->test_ssh_connection($target_credentials)) {
            return $this->push_plugin_via_ssh($plugin_dir, $plugin_name, $target_credentials);
        } else {
            return $this->push_plugin_via_rest($plugin_dir, $plugin_name, $target_url, $target_credentials);
        }
    }
    
    private function pull_plugin($plugin_name, $target_url, $target_credentials) {
        $plugin_file = $this->find_plugin_file($plugin_name);
        $local_plugin_dir = $plugin_file ? dirname(WP_PLUGIN_DIR . '/' . $plugin_file) : WP_PLUGIN_DIR . '/' . sanitize_file_name($plugin_name);
        
        // Try SSH first, fallback to REST API
        if ($this->ssh_handler->test_ssh_connection($target_credentials)) {
            return $this->pull_plugin_via_ssh($local_plugin_dir, $plugin_name, $target_credentials);
        } else {
            return $this->pull_plugin_via_rest($plugin_name, $target_url, $target_credentials);
        }
    }
    
    private function push_plugin_via_ssh($plugin_dir, $plugin_name, $target_credentials) {
        $remote_wp_path = $this->ssh_handler->get_remote_wp_path($target_credentials);
        $remote_plugin_dir = $remote_wp_path . '/wp-content/plugins/' . basename($plugin_dir);
        
        return $this->ssh_handler->sync_directory_via_ssh($plugin_dir, $remote_plugin_dir, $target_credentials, 'push');
    }
    
    private function pull_plugin_via_ssh($local_plugin_dir, $plugin_name, $target_credentials) {
        $remote_wp_path = $this->ssh_handler->get_remote_wp_path($target_credentials);
        $remote_plugin_dir = $remote_wp_path . '/wp-content/plugins/' . basename($local_plugin_dir);
        
        return $this->ssh_handler->sync_directory_via_ssh($local_plugin_dir, $remote_plugin_dir, $target_credentials, 'pull');
    }
    
    private function push_plugin_via_rest($plugin_dir, $plugin_name, $target_url, $target_credentials) {
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->create_zip_from_directory($plugin_dir, $file_handler->get_temp_filename($plugin_name . '_plugin'));
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $result = $communicator->send_plugin_to_target($zip_file, $plugin_name, $target_url, $target_credentials);
        $result['method'] = 'rest_api';
        
        return $result;
    }
    
    private function pull_plugin_via_rest($plugin_name, $target_url, $target_credentials) {
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $plugin_data = $communicator->request_plugin_from_target($plugin_name, $target_url, $target_credentials);
        $result = $this->install_plugin_from_data($plugin_data, $plugin_name);
        $result['method'] = 'rest_api';
        
        return $result;
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
        
        return array('success' => true, 'method' => 'rest_api');
    }
}
