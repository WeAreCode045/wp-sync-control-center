
<?php
/**
 * Sync operations and file handling
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Sync {
    
    public function execute_sync($operation_type, $components, $target_url, $target_credentials) {
        $results = array(
            'operation_type' => $operation_type,
            'success' => true,
            'message' => 'Sync operation completed successfully',
            'details' => array(),
        );
        
        // Sync plugins
        if (!empty($components['plugins']['selected'])) {
            $plugin_result = $this->sync_plugins($components['plugins']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['plugins'] = $plugin_result;
        }
        
        // Sync themes
        if (!empty($components['themes']['selected'])) {
            $theme_result = $this->sync_themes($components['themes']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['themes'] = $theme_result;
        }
        
        // Sync database
        if (!empty($components['database']['selected'])) {
            $database_result = $this->sync_database($components['database']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['database'] = $database_result;
        }
        
        // Sync media
        if (!empty($components['media']) && $components['media']) {
            $media_result = $this->sync_media($operation_type, $target_url, $target_credentials);
            $results['details']['media'] = $media_result;
        }
        
        return $results;
    }
    
    private function sync_plugins($selected_plugins, $operation_type, $target_url, $target_credentials) {
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
    
    private function sync_themes($selected_themes, $operation_type, $target_url, $target_credentials) {
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
    
    private function sync_database($selected_tables, $operation_type, $target_url, $target_credentials) {
        global $wpdb;
        $results = array();
        
        foreach ($selected_tables as $table_name) {
            try {
                if ($operation_type === 'push') {
                    $result = $this->push_database_table($table_name, $target_url, $target_credentials);
                } else {
                    $result = $this->pull_database_table($table_name, $target_url, $target_credentials);
                }
                
                $results[] = array(
                    'table' => $table_name,
                    'success' => true,
                    'message' => "Table {$table_name} synced successfully",
                );
            } catch (Exception $e) {
                $results[] = array(
                    'table' => $table_name,
                    'success' => false,
                    'message' => "Failed to sync table {$table_name}: " . $e->getMessage(),
                );
            }
        }
        
        return $results;
    }
    
    private function sync_media($operation_type, $target_url, $target_credentials) {
        try {
            if ($operation_type === 'push') {
                $result = $this->push_media($target_url, $target_credentials);
            } else {
                $result = $this->pull_media($target_url, $target_credentials);
            }
            
            return array(
                'success' => true,
                'message' => 'Media files synced successfully',
                'count' => $result['count'] ?? 0,
            );
        } catch (Exception $e) {
            return array(
                'success' => false,
                'message' => 'Failed to sync media: ' . $e->getMessage(),
            );
        }
    }
    
    // Plugin sync operations
    private function push_plugin($plugin_name, $target_url, $target_credentials) {
        $plugin_file = $this->find_plugin_file($plugin_name);
        if (!$plugin_file) {
            throw new Exception("Plugin file not found for {$plugin_name}");
        }
        
        $plugin_dir = dirname(WP_PLUGIN_DIR . '/' . $plugin_file);
        $zip_file = $this->create_plugin_zip($plugin_dir, $plugin_name);
        
        return $this->send_plugin_to_target($zip_file, $plugin_name, $target_url, $target_credentials);
    }
    
    private function pull_plugin($plugin_name, $target_url, $target_credentials) {
        $plugin_data = $this->request_plugin_from_target($plugin_name, $target_url, $target_credentials);
        return $this->install_plugin_from_data($plugin_data, $plugin_name);
    }
    
    // Theme sync operations
    private function push_theme($theme_name, $target_url, $target_credentials) {
        $theme_dir = get_theme_root() . '/' . $theme_name;
        if (!is_dir($theme_dir)) {
            throw new Exception("Theme directory not found for {$theme_name}");
        }
        
        $zip_file = $this->create_theme_zip($theme_dir, $theme_name);
        return $this->send_theme_to_target($zip_file, $theme_name, $target_url, $target_credentials);
    }
    
    private function pull_theme($theme_name, $target_url, $target_credentials) {
        $theme_data = $this->request_theme_from_target($theme_name, $target_url, $target_credentials);
        return $this->install_theme_from_data($theme_data, $theme_name);
    }
    
    // Database sync operations
    private function push_database_table($table_name, $target_url, $target_credentials) {
        global $wpdb;
        
        // Export table structure and data
        $table_sql = $this->export_table_sql($table_name);
        
        // Send to target environment
        return $this->send_table_to_target($table_sql, $table_name, $target_url, $target_credentials);
    }
    
    private function pull_database_table($table_name, $target_url, $target_credentials) {
        $table_sql = $this->request_table_from_target($table_name, $target_url, $target_credentials);
        return $this->import_table_sql($table_sql, $table_name);
    }
    
    // Media sync operations
    private function push_media($target_url, $target_credentials) {
        $upload_dir = wp_upload_dir();
        $media_files = $this->get_media_files();
        
        $zip_file = $this->create_media_zip($media_files);
        $media_db_data = $this->export_media_database_entries();
        
        return $this->send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials);
    }
    
    private function pull_media($target_url, $target_credentials) {
        $media_data = $this->request_media_from_target($target_url, $target_credentials);
        return $this->install_media_from_data($media_data);
    }
    
    // Helper methods for plugin operations
    private function find_plugin_file($plugin_name) {
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
    
    private function create_plugin_zip($plugin_dir, $plugin_name) {
        $zip = new ZipArchive();
        $zip_filename = sys_get_temp_dir() . '/' . sanitize_file_name($plugin_name) . '_plugin.zip';
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create zip file");
        }
        
        $this->add_directory_to_zip($zip, $plugin_dir, '');
        $zip->close();
        
        return $zip_filename;
    }
    
    private function create_theme_zip($theme_dir, $theme_name) {
        $zip = new ZipArchive();
        $zip_filename = sys_get_temp_dir() . '/' . sanitize_file_name($theme_name) . '_theme.zip';
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create zip file");
        }
        
        $this->add_directory_to_zip($zip, $theme_dir, '');
        $zip->close();
        
        return $zip_filename;
    }
    
    private function add_directory_to_zip($zip, $dir, $zip_dir) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if ($file != '.' && $file != '..') {
                $file_path = $dir . '/' . $file;
                $zip_path = $zip_dir ? $zip_dir . '/' . $file : $file;
                
                if (is_dir($file_path)) {
                    $zip->addEmptyDir($zip_path);
                    $this->add_directory_to_zip($zip, $file_path, $zip_path);
                } else {
                    $zip->addFile($file_path, $zip_path);
                }
            }
        }
    }
    
    // Database helper methods
    private function export_table_sql($table_name) {
        global $wpdb;
        
        // Get table structure
        $structure = $wpdb->get_row("SHOW CREATE TABLE `{$table_name}`", ARRAY_N);
        $create_table = $structure[1];
        
        // Get table data
        $rows = $wpdb->get_results("SELECT * FROM `{$table_name}`", ARRAY_A);
        
        $sql = "DROP TABLE IF EXISTS `{$table_name}`;\n";
        $sql .= $create_table . ";\n\n";
        
        foreach ($rows as $row) {
            $values = array();
            foreach ($row as $value) {
                $values[] = $value === null ? 'NULL' : "'" . $wpdb->_escape($value) . "'";
            }
            $sql .= "INSERT INTO `{$table_name}` VALUES (" . implode(', ', $values) . ");\n";
        }
        
        return $sql;
    }
    
    private function import_table_sql($sql, $table_name) {
        global $wpdb;
        
        // Split SQL into individual queries
        $queries = explode(';', $sql);
        
        foreach ($queries as $query) {
            $query = trim($query);
            if (!empty($query)) {
                $result = $wpdb->query($query);
                if ($result === false) {
                    throw new Exception("Failed to execute query: " . $wpdb->last_error);
                }
            }
        }
        
        return true;
    }
    
    // Media helper methods
    private function get_media_files() {
        $upload_dir = wp_upload_dir();
        $media_files = array();
        
        $args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
        );
        
        $attachments = get_posts($args);
        
        foreach ($attachments as $attachment) {
            $file_path = get_attached_file($attachment->ID);
            if (file_exists($file_path)) {
                $media_files[] = array(
                    'id' => $attachment->ID,
                    'path' => $file_path,
                    'relative_path' => str_replace($upload_dir['basedir'], '', $file_path),
                );
            }
        }
        
        return $media_files;
    }
    
    private function create_media_zip($media_files) {
        $zip = new ZipArchive();
        $zip_filename = sys_get_temp_dir() . '/media_files.zip';
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create media zip file");
        }
        
        foreach ($media_files as $file) {
            $zip->addFile($file['path'], ltrim($file['relative_path'], '/'));
        }
        
        $zip->close();
        return $zip_filename;
    }
    
    private function export_media_database_entries() {
        global $wpdb;
        
        // Export attachment posts and their metadata
        $sql = "SELECT * FROM {$wpdb->posts} WHERE post_type = 'attachment'";
        $attachments = $wpdb->get_results($sql, ARRAY_A);
        
        $metadata_sql = "SELECT * FROM {$wpdb->postmeta} WHERE post_id IN (
            SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment'
        )";
        $metadata = $wpdb->get_results($metadata_sql, ARRAY_A);
        
        return array(
            'attachments' => $attachments,
            'metadata' => $metadata,
        );
    }
    
    // Network communication methods
    private function send_plugin_to_target($zip_file, $plugin_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-plugin';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        unlink($zip_file); // Clean up temp file
        
        $response = $this->make_authenticated_request($endpoint, array(
            'plugin_name' => $plugin_name,
            'file_data' => $file_data,
        ), $target_credentials);
        
        return $response;
    }
    
    private function send_theme_to_target($zip_file, $theme_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-theme';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        unlink($zip_file);
        
        $response = $this->make_authenticated_request($endpoint, array(
            'theme_name' => $theme_name,
            'file_data' => $file_data,
        ), $target_credentials);
        
        return $response;
    }
    
    private function send_table_to_target($table_sql, $table_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-table';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
            'table_sql' => $table_sql,
        ), $target_credentials);
        
        return $response;
    }
    
    private function send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/receive-media';
        
        $file_data = base64_encode(file_get_contents($zip_file));
        unlink($zip_file);
        
        $response = $this->make_authenticated_request($endpoint, array(
            'file_data' => $file_data,
            'db_data' => $media_db_data,
        ), $target_credentials);
        
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
    
    // Pull request methods
    private function request_plugin_from_target($plugin_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-plugin';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'plugin_name' => $plugin_name,
        ), $target_credentials);
        
        return $response;
    }
    
    private function request_theme_from_target($theme_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-theme';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'theme_name' => $theme_name,
        ), $target_credentials);
        
        return $response;
    }
    
    private function request_table_from_target($table_name, $target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-table';
        
        $response = $this->make_authenticated_request($endpoint, array(
            'table_name' => $table_name,
        ), $target_credentials);
        
        return $response;
    }
    
    private function request_media_from_target($target_url, $target_credentials) {
        $endpoint = rtrim($target_url, '/') . '/wp-json/wp-sync-manager/v1/send-media';
        
        $response = $this->make_authenticated_request($endpoint, array(), $target_credentials);
        
        return $response;
    }
    
    // Installation methods
    private function install_plugin_from_data($plugin_data, $plugin_name) {
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
        $zip = new ZipArchive();
        if ($zip->open($temp_file) === TRUE) {
            $zip->extractTo($plugin_dir);
            $zip->close();
            unlink($temp_file);
            return true;
        } else {
            unlink($temp_file);
            throw new Exception("Failed to extract plugin zip file");
        }
    }
    
    private function install_theme_from_data($theme_data, $theme_name) {
        $theme_dir = get_theme_root() . '/' . sanitize_file_name($theme_name);
        
        if (!is_dir($theme_dir)) {
            wp_mkdir_p($theme_dir);
        }
        
        $zip_data = base64_decode($theme_data['file_data']);
        $temp_file = sys_get_temp_dir() . '/' . $theme_name . '.zip';
        file_put_contents($temp_file, $zip_data);
        
        $zip = new ZipArchive();
        if ($zip->open($temp_file) === TRUE) {
            $zip->extractTo($theme_dir);
            $zip->close();
            unlink($temp_file);
            return true;
        } else {
            unlink($temp_file);
            throw new Exception("Failed to extract theme zip file");
        }
    }
    
    private function install_media_from_data($media_data) {
        $upload_dir = wp_upload_dir();
        
        // Extract media files
        $zip_data = base64_decode($media_data['file_data']);
        $temp_file = sys_get_temp_dir() . '/media.zip';
        file_put_contents($temp_file, $zip_data);
        
        $zip = new ZipArchive();
        if ($zip->open($temp_file) === TRUE) {
            $zip->extractTo($upload_dir['basedir']);
            $zip->close();
            unlink($temp_file);
        } else {
            unlink($temp_file);
            throw new Exception("Failed to extract media zip file");
        }
        
        // Import database entries
        $this->import_media_database_entries($media_data['db_data']);
        
        return array('count' => count($media_data['db_data']['attachments']));
    }
    
    private function import_media_database_entries($db_data) {
        global $wpdb;
        
        // Import attachment posts
        foreach ($db_data['attachments'] as $attachment) {
            // Check if attachment already exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE ID = %d",
                $attachment['ID']
            ));
            
            if (!$existing) {
                $wpdb->insert($wpdb->posts, $attachment);
            }
        }
        
        // Import metadata
        foreach ($db_data['metadata'] as $meta) {
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = %s",
                $meta['post_id'],
                $meta['meta_key']
            ));
            
            if (!$existing) {
                $wpdb->insert($wpdb->postmeta, $meta);
            }
        }
    }
}
