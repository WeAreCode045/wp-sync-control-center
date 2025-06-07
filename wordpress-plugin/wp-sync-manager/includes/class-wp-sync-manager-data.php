
<?php
/**
 * Data fetching and management
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Data {
    
    public function get_all_data() {
        return array(
            'plugins' => $this->get_plugins_data(),
            'themes' => $this->get_themes_data(),
            'tables' => $this->get_database_tables(),
            'media_count' => $this->get_media_count(),
            'site_info' => array(
                'url' => get_site_url(),
                'name' => get_bloginfo('name'),
                'wp_version' => get_bloginfo('version'),
                'php_version' => PHP_VERSION,
            )
        );
    }
    
    public function get_plugins_data() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        $plugins = array();
        
        foreach ($all_plugins as $plugin_file => $plugin_data) {
            $plugins[] = array(
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'status' => in_array($plugin_file, $active_plugins) ? 'active' : 'inactive',
                'file' => $plugin_file,
                'description' => $plugin_data['Description'],
                'author' => $plugin_data['Author'],
            );
        }
        
        return $plugins;
    }
    
    public function get_themes_data() {
        $all_themes = wp_get_themes();
        $active_theme = get_stylesheet();
        $themes = array();
        
        foreach ($all_themes as $theme_slug => $theme) {
            $themes[] = array(
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'status' => ($theme_slug === $active_theme) ? 'active' : 'inactive',
                'slug' => $theme_slug,
                'description' => $theme->get('Description'),
                'author' => $theme->get('Author'),
            );
        }
        
        return $themes;
    }
    
    public function get_database_tables() {
        global $wpdb;
        
        $tables = $wpdb->get_results("SHOW TABLES", ARRAY_N);
        $table_data = array();
        
        foreach ($tables as $table) {
            $table_name = $table[0];
            $count_result = $wpdb->get_var("SELECT COUNT(*) FROM `{$table_name}`");
            
            $table_data[] = array(
                'name' => $table_name,
                'rows' => intval($count_result),
            );
        }
        
        return $table_data;
    }
    
    public function get_media_count() {
        $media_query = new WP_Query(array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
            'fields' => 'ids',
        ));
        
        return $media_query->found_posts;
    }
}
