
<?php
/**
 * Network communication operations for sync
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Network_Communicator {
    
    public function send_plugin_to_target($zip_file, $plugin_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-plugin';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->cleanup_temp_file($zip_file);
        
        $response = $this->make_authenticated_request($endpoint, array(
            'plugin_name' => $plugin_name,
            'file_data' => $file_data,
        ), $target_credentials);
        
        return $response;
    }
    
    public function send_theme_to_target($zip_file, $theme_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-theme';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->cleanup_temp_file($zip_file);
        
        $response = $this->make_authenticated_request($endpoint, array(
            'theme_name' => $theme_name,
            'file_data' => $file_data,
        ), $target_credentials);
        
        return $response;
    }
    
    public function send_table_to_target($table_sql, $table_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-table';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
            'table_sql' => $table_sql,
        ), $target_credentials);
        
        return $response;
    }
    
    public function send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-media';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->cleanup_temp_file($zip_file);
        
        $response = $this->make_authenticated_request($endpoint, array(
            'file_data' => $file_data,
            'db_data' => $media_db_data,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_plugin_from_target($plugin_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-plugin';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'plugin_name' => $plugin_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_theme_from_target($theme_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-theme';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'theme_name' => $theme_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_table_from_target($table_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-table';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_media_from_target($target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-media';
        
        $response = $this->make_authenticated_request($endpoint, array(), $target_credentials);
        
        return $response;
    }
    
    private function make_authenticated_request($url, $data, $credentials) {
        $auth_header = base64_encode($credentials['username'] . ':' . $credentials['password']);
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Basic ' . $auth_header,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($data),
            'timeout' => 300, // 5 minutes for large transfers
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Request failed: ' . $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);
        
        if (wp_remote_retrieve_response_code($response) !== 200) {
            throw new Exception('Request failed with status ' . wp_remote_retrieve_response_code($response));
        }
        
        return $decoded;
    }
}
