
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
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/receive-plugin');
        
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
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/receive-theme');
        
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
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/receive-table');
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
            'table_sql' => $table_sql,
        ), $target_credentials);
        
        return $response;
    }
    
    public function send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials) {
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/receive-media');
        
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
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/send-plugin');
        
        $response = $this->make_authenticated_request($endpoint, array(
            'plugin_name' => $plugin_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_theme_from_target($theme_name, $target_url, $target_credentials) {
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/send-theme');
        
        $response = $this->make_authenticated_request($endpoint, array(
            'theme_name' => $theme_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_table_from_target($table_name, $target_url, $target_credentials) {
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/send-table');
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
        ), $target_credentials);
        
        return $response;
    }
    
    public function request_media_from_target($target_url, $target_credentials) {
        $endpoint = $this->build_endpoint_url($target_url, '/wp-json/wp-sync-manager/v1/send-media');
        
        $response = $this->make_authenticated_request($endpoint, array(), $target_credentials);
        
        return $response;
    }
    
    private function build_endpoint_url($base_url, $endpoint_path) {
        // Clean up the base URL
        $base_url = rtrim($base_url, '/');
        
        // Ensure we have a valid URL scheme
        if (!preg_match('/^https?:\/\//', $base_url)) {
            $base_url = 'https://' . $base_url;
        }
        
        // Build the full endpoint URL
        $full_url = $base_url . $endpoint_path;
        
        // Log the constructed URL for debugging
        error_log("WP Sync Manager: Constructed endpoint URL: " . $full_url);
        
        return $full_url;
    }
    
    private function make_authenticated_request($url, $data, $credentials) {
        // Log request details for debugging
        error_log("WP Sync Manager: Making request to URL: " . $url);
        error_log("WP Sync Manager: Credentials username: " . ($credentials['username'] ?? 'NOT SET'));
        
        // Validate URL before making request
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new Exception('Invalid URL provided: ' . $url);
        }
        
        // Prepare authentication
        if (empty($credentials['username']) || empty($credentials['password'])) {
            throw new Exception('Missing authentication credentials');
        }
        
        $auth_header = base64_encode($credentials['username'] . ':' . $credentials['password']);
        
        $args = array(
            'headers' => array(
                'Authorization' => 'Basic ' . $auth_header,
                'Content-Type' => 'application/json',
                'User-Agent' => 'WP-Sync-Manager/' . WP_SYNC_MANAGER_VERSION,
            ),
            'body' => json_encode($data),
            'timeout' => 300, // 5 minutes for large transfers
            'sslverify' => false, // Allow self-signed certificates for dev environments
        );
        
        error_log("WP Sync Manager: Request args: " . print_r($args, true));
        
        $response = wp_remote_post($url, $args);
        
        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            error_log("WP Sync Manager: Request failed with error: " . $error_message);
            throw new Exception('Request failed: ' . $error_message);
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        error_log("WP Sync Manager: Response code: " . $response_code);
        error_log("WP Sync Manager: Response body: " . $body);
        
        if ($response_code !== 200) {
            $error_message = "Request failed with status " . $response_code;
            if (!empty($body)) {
                $decoded_body = json_decode($body, true);
                if (isset($decoded_body['message'])) {
                    $error_message .= ": " . $decoded_body['message'];
                }
            }
            throw new Exception($error_message);
        }
        
        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response received');
        }
        
        return $decoded;
    }
}
