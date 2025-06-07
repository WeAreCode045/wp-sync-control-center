
<?php
/**
 * Main sync coordinator
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Sync {
    
    private $plugin_sync;
    private $theme_sync;
    private $database_sync;
    private $media_sync;
    
    public function __construct() {
        $this->plugin_sync = new WP_Sync_Manager_Plugin_Sync();
        $this->theme_sync = new WP_Sync_Manager_Theme_Sync();
        $this->database_sync = new WP_Sync_Manager_Database_Sync();
        $this->media_sync = new WP_Sync_Manager_Media_Sync();
    }
    
    public function execute_sync($operation_type, $components, $target_url, $target_credentials) {
        $results = array(
            'operation_type' => $operation_type,
            'success' => true,
            'message' => 'Sync operation completed successfully',
            'details' => array(),
        );
        
        // Sync plugins
        if (!empty($components['plugins']['selected'])) {
            $plugin_result = $this->plugin_sync->sync_plugins($components['plugins']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['plugins'] = $plugin_result;
        }
        
        // Sync themes
        if (!empty($components['themes']['selected'])) {
            $theme_result = $this->theme_sync->sync_themes($components['themes']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['themes'] = $theme_result;
        }
        
        // Sync database
        if (!empty($components['database']['selected'])) {
            $database_result = $this->database_sync->sync_database($components['database']['selected'], $operation_type, $target_url, $target_credentials);
            $results['details']['database'] = $database_result;
        }
        
        // Sync media
        if (!empty($components['media']) && $components['media']) {
            $media_result = $this->media_sync->sync_media($operation_type, $target_url, $target_credentials);
            $results['details']['media'] = $media_result;
        }
        
        return $results;
    }
    
    // Delegate methods for REST API compatibility
    public function find_plugin_file($plugin_name) {
        return $this->plugin_sync->find_plugin_file($plugin_name);
    }
    
    public function install_plugin_from_data($plugin_data, $plugin_name) {
        return $this->plugin_sync->install_plugin_from_data($plugin_data, $plugin_name);
    }
    
    public function install_theme_from_data($theme_data, $theme_name) {
        return $this->theme_sync->install_theme_from_data($theme_data, $theme_name);
    }
    
    public function export_table_sql($table_name) {
        return $this->database_sync->export_table_sql($table_name);
    }
    
    public function import_table_sql($table_sql, $table_name) {
        return $this->database_sync->import_table_sql($table_sql, $table_name);
    }
    
    public function get_media_files() {
        return $this->media_sync->get_media_files();
    }
    
    public function export_media_database_entries() {
        return $this->media_sync->export_media_database_entries();
    }
    
    public function install_media_from_data($media_data) {
        return $this->media_sync->install_media_from_data($media_data);
    }
}
