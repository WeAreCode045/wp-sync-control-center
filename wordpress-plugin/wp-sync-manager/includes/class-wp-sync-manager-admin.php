
<?php
/**
 * Admin interface and menu
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Admin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }
    
    public function add_admin_menu() {
        add_management_page(
            'WP Sync Manager',
            'Sync Manager',
            'manage_options',
            'wp-sync-manager',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>WP Sync Manager</h1>
            <p>WordPress Synchronization Manager is active. Use your external sync tool to manage synchronization.</p>
            <h2>Plugin Information</h2>
            <table class="form-table">
                <tr>
                    <th scope="row">Plugin Version</th>
                    <td><?php echo esc_html(WP_SYNC_MANAGER_VERSION); ?></td>
                </tr>
                <tr>
                    <th scope="row">API Endpoint</th>
                    <td><?php echo esc_url(get_rest_url(null, 'wp-sync-manager/v1/')); ?></td>
                </tr>
                <tr>
                    <th scope="row">Site URL</th>
                    <td><?php echo esc_url(get_site_url()); ?></td>
                </tr>
            </table>
            
            <h2>Available Endpoints</h2>
            <ul>
                <li><strong>GET</strong> <code>/wp-json/wp-sync-manager/v1/data</code> - Get WordPress data</li>
                <li><strong>POST</strong> <code>/wp-json/wp-sync-manager/v1/sync</code> - Execute sync operation</li>
                <li><strong>GET</strong> <code>/wp-json/wp-sync-manager/v1/status</code> - Get sync status</li>
            </ul>
        </div>
        <?php
    }
}
