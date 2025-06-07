
<?php
/**
 * Plugin Name: WP Sync Manager
 * Plugin URI: https://code045.nl
 * Description: WordPress synchronization manager for syncing plugins, themes, database tables, and media between environments.
 * Version: 1.0.0
 * Author: Code045
 * License: GPL v2 or later
 * Text Domain: wp-sync-manager
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WP_SYNC_MANAGER_VERSION', '1.0.0');
define('WP_SYNC_MANAGER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WP_SYNC_MANAGER_PLUGIN_URL', plugin_dir_url(__FILE__));

// Include required files
require_once WP_SYNC_MANAGER_PLUGIN_DIR . 'includes/class-wp-sync-manager-core.php';

// Initialize the plugin
new WP_Sync_Manager_Core();
