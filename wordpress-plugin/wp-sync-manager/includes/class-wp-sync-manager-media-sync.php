
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
        
        $media_files = $this->get_media_files();
        
        if (empty($media_files)) {
            error_log("WP Sync Manager Media Sync: No media files found to push");
            return array('count' => 0);
        }
        
        $file_handler = new WP_Sync_Manager_File_Handler();
        $zip_file = $file_handler->get_temp_filename('media_files');
        
        try {
            $this->create_media_zip($media_files, $zip_file);
            $media_db_data = $this->export_media_database_entries();
            
            $communicator = new WP_Sync_Manager_Network_Communicator();
            $result = $communicator->send_media_to_target($zip_file, $media_db_data, $target_url, $target_credentials);
            
            return array('count' => count($media_files));
        } finally {
            // Always clean up temp file
            $file_handler->cleanup_temp_file($zip_file);
        }
    }
    
    private function pull_media($target_url, $target_credentials) {
        error_log("WP Sync Manager Media Sync: Pulling media from {$target_url}");
        
        $communicator = new WP_Sync_Manager_Network_Communicator();
        
        try {
            $media_data = $communicator->request_media_from_target($target_url, $target_credentials);
            return $this->install_media_from_data($media_data);
        } catch (Exception $e) {
            if (strpos($e->getMessage(), '404') !== false) {
                throw new Exception("No media data found on source environment or media endpoint not accessible.");
            }
            throw $e;
        }
    }
    
    public function get_media_files() {
        $upload_dir = wp_upload_dir();
        $media_files = array();
        
        if (!$upload_dir || isset($upload_dir['error'])) {
            error_log("WP Sync Manager Media Sync: Failed to get upload directory: " . ($upload_dir['error'] ?? 'Unknown error'));
            return array();
        }
        
        $args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
        );
        
        $attachments = get_posts($args);
        
        foreach ($attachments as $attachment) {
            $file_path = get_attached_file($attachment->ID);
            if ($file_path && file_exists($file_path)) {
                $relative_path = str_replace($upload_dir['basedir'], '', $file_path);
                $media_files[] = array(
                    'id' => $attachment->ID,
                    'path' => $file_path,
                    'relative_path' => $relative_path,
                    'url' => wp_get_attachment_url($attachment->ID),
                    'title' => $attachment->post_title,
                    'alt' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
                );
            }
        }
        
        error_log("WP Sync Manager Media Sync: Found " . count($media_files) . " media files");
        return $media_files;
    }
    
    public function create_media_zip($media_files, $zip_filename) {
        error_log("WP Sync Manager Media Sync: Creating media zip with " . count($media_files) . " files");
        
        if (!class_exists('ZipArchive')) {
            throw new Exception('ZipArchive class is not available');
        }
        
        $zip = new ZipArchive();
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create media zip file: {$zip_filename}");
        }
        
        $added_files = 0;
        foreach ($media_files as $file) {
            if (file_exists($file['path'])) {
                $archive_path = ltrim($file['relative_path'], '/');
                if ($zip->addFile($file['path'], $archive_path)) {
                    $added_files++;
                } else {
                    error_log("WP Sync Manager Media Sync: Failed to add file to zip: " . $file['path']);
                }
            } else {
                error_log("WP Sync Manager Media Sync: File not found: " . $file['path']);
            }
        }
        
        $zip->close();
        
        if ($added_files === 0) {
            throw new Exception("No files were added to the media zip");
        }
        
        error_log("WP Sync Manager Media Sync: Media zip created successfully with {$added_files} files");
        
        return $zip_filename;
    }
    
    public function export_media_database_entries() {
        global $wpdb;
        
        error_log("WP Sync Manager Media Sync: Exporting media database entries");
        
        // Export attachment posts and their metadata
        $sql = $wpdb->prepare("SELECT * FROM {$wpdb->posts} WHERE post_type = %s", 'attachment');
        $attachments = $wpdb->get_results($sql, ARRAY_A);
        
        if (empty($attachments)) {
            error_log("WP Sync Manager Media Sync: No attachments found in database");
            return array('attachments' => array(), 'metadata' => array());
        }
        
        $attachment_ids = wp_list_pluck($attachments, 'ID');
        $placeholders = implode(',', array_fill(0, count($attachment_ids), '%d'));
        
        $metadata_sql = $wpdb->prepare(
            "SELECT * FROM {$wpdb->postmeta} WHERE post_id IN ({$placeholders})",
            $attachment_ids
        );
        $metadata = $wpdb->get_results($metadata_sql, ARRAY_A);
        
        error_log("WP Sync Manager Media Sync: Exported " . count($attachments) . " attachments and " . count($metadata) . " metadata entries");
        
        return array(
            'attachments' => $attachments,
            'metadata' => $metadata,
        );
    }
    
    public function install_media_from_data($media_data) {
        error_log("WP Sync Manager Media Sync: Installing media from data");
        
        if (!isset($media_data['file_data']) || !isset($media_data['db_data'])) {
            throw new Exception("Invalid media data structure received");
        }
        
        $upload_dir = wp_upload_dir();
        
        if (!$upload_dir || isset($upload_dir['error'])) {
            throw new Exception("Failed to get upload directory: " . ($upload_dir['error'] ?? 'Unknown error'));
        }
        
        // Extract media files
        $zip_data = base64_decode($media_data['file_data']);
        if ($zip_data === false) {
            throw new Exception("Failed to decode media file data");
        }
        
        $temp_file = sys_get_temp_dir() . '/media_' . time() . '.zip';
        if (file_put_contents($temp_file, $zip_data) === false) {
            throw new Exception("Failed to write temporary media file");
        }
        
        try {
            $file_handler = new WP_Sync_Manager_File_Handler();
            $file_handler->extract_zip_to_directory($temp_file, $upload_dir['basedir']);
            $file_handler->cleanup_temp_file($temp_file);
            
            // Import database entries
            $this->import_media_database_entries($media_data['db_data']);
            
            $count = isset($media_data['db_data']['attachments']) ? count($media_data['db_data']['attachments']) : 0;
            error_log("WP Sync Manager Media Sync: Media installation completed with {$count} items");
            
            return array('count' => $count);
        } catch (Exception $e) {
            // Clean up temp file even if extraction fails
            if (file_exists($temp_file)) {
                unlink($temp_file);
            }
            throw new Exception("Failed to install media: " . $e->getMessage());
        }
    }
    
    private function import_media_database_entries($db_data) {
        global $wpdb;
        
        error_log("WP Sync Manager Media Sync: Importing media database entries");
        
        if (!isset($db_data['attachments']) || !isset($db_data['metadata'])) {
            throw new Exception("Invalid database data structure");
        }
        
        $imported_attachments = 0;
        $imported_metadata = 0;
        
        // Import attachment posts
        foreach ($db_data['attachments'] as $attachment) {
            // Check if attachment already exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE ID = %d",
                $attachment['ID']
            ));
            
            if (!$existing) {
                $result = $wpdb->insert($wpdb->posts, $attachment);
                if ($result !== false) {
                    $imported_attachments++;
                }
            }
        }
        
        // Import metadata
        foreach ($db_data['metadata'] as $meta) {
            // Check if metadata already exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = %s",
                $meta['post_id'],
                $meta['meta_key']
            ));
            
            if (!$existing) {
                $result = $wpdb->insert($wpdb->postmeta, $meta);
                if ($result !== false) {
                    $imported_metadata++;
                }
            }
        }
        
        error_log("WP Sync Manager Media Sync: Imported {$imported_attachments} attachments and {$imported_metadata} metadata entries");
    }
}
