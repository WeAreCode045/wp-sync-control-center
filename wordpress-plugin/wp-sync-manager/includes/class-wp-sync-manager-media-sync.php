
<?php
/**
 * Media sync operations
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Media_Sync {
    
    public function sync_media($operation_type, $target_url, $target_credentials) {
        error_log("WP Sync Manager Media Sync: Starting media sync - Operation: {$operation_type}, Target URL: {$target_url}");
        
        try {
            if ($operation_type === 'push') {
                $result = $this->push_media($target_url, $target_credentials);
            } else {
                $result = $this->pull_media($target_url, $target_credentials);
            }
            
            error_log("WP Sync Manager Media Sync: Media sync completed successfully");
            
            return array(
                'success' => true,
                'message' => 'Media files synced successfully',
                'count' => $result['count'] ?? 0,
            );
        } catch (Exception $e) {
            error_log("WP Sync Manager Media Sync: Media sync failed: " . $e->getMessage());
            return array(
                'success' => false,
                'message' => 'Failed to sync media: ' . $e->getMessage(),
            );
        }
    }
    
    private function push_media($target_url, $target_credentials) {
        error_log("WP Sync Manager Media Sync: Pushing media to {$target_url}");
        
        $upload_dir = wp_upload_dir();
        $media_files = $this->get_media_files();
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->get_temp_filename('media_files');
        $this->create_media_zip($media_files, $zip_file);
        
        $media_db_data = $this->export_media_database_entries();
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        return $communicator->send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials);
    }
    
    private function pull_media($target_url, $target_credentials) {
        error_log("WP Sync Manager Media Sync: Pulling media from {$target_url}");
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $media_data = $communicator->request_media_from_target($target_url, $target_credentials);
        return $this->install_media_from_data($media_data);
    }
    
    public function get_media_files() {
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
    
    public function create_media_zip($media_files, $zip_filename) {
        error_log("WP Sync Manager Media Sync: Creating media zip with " . count($media_files) . " files");
        
        $zip = new ZipArchive();
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create media zip file");
        }
        
        foreach ($media_files as $file) {
            $zip->addFile($file['path'], ltrim($file['relative_path'], '/'));
        }
        
        $zip->close();
        
        error_log("WP Sync Manager Media Sync: Media zip created successfully");
        
        return $zip_filename;
    }
    
    public function export_media_database_entries() {
        global $wpdb;
        
        error_log("WP Sync Manager Media Sync: Exporting media database entries");
        
        // Export attachment posts and their metadata
        $sql = "SELECT * FROM {$wpdb->posts} WHERE post_type = 'attachment'";
        $attachments = $wpdb->get_results($sql, ARRAY_A);
        
        $metadata_sql = "SELECT * FROM {$wpdb->postmeta} WHERE post_id IN (
            SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment'
        )";
        $metadata = $wpdb->get_results($metadata_sql, ARRAY_A);
        
        error_log("WP Sync Manager Media Sync: Exported " . count($attachments) . " attachments and " . count($metadata) . " metadata entries");
        
        return array(
            'attachments' => $attachments,
            'metadata' => $metadata,
        );
    }
    
    public function install_media_from_data($media_data) {
        error_log("WP Sync Manager Media Sync: Installing media from data");
        
        $upload_dir = wp_upload_dir();
        
        // Extract media files
        $zip_data = base64_decode($media_data['file_data']);
        $temp_file = sys_get_temp_dir() . '/media.zip';
        file_put_contents($temp_file, $zip_data);
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $file_handler->extract_zip_to_directory($temp_file, $upload_dir['basedir']);
        $file_handler->cleanup_temp_file($temp_file);
        
        // Import database entries
        $this->import_media_database_entries($media_data['db_data']);
        
        error_log("WP Sync Manager Media Sync: Media installation completed");
        
        return array('count' => count($media_data['db_data']['attachments']));
    }
    
    private function import_media_database_entries($db_data) {
        global $wpdb;
        
        error_log("WP Sync Manager Media Sync: Importing media database entries");
        
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
        
        error_log("WP Sync Manager Media Sync: Database entries imported successfully");
    }
}
