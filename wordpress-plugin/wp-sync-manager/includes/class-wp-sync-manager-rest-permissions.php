
<?php
/**
 * REST API permissions handler
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_REST_Permissions {
    
    public function check_sync_permissions($request) {
        // Handle OPTIONS requests without authentication
        if ($request->get_method() === 'OPTIONS') {
            return true;
        }
        
        // Log the authentication attempt
        error_log("WP Sync Manager REST API: Checking permissions for request");
        
        // Check for Basic Authentication first
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
            if (strpos($auth_header, 'Basic ') === 0) {
                $credentials = base64_decode(substr($auth_header, 6));
                $parts = explode(':', $credentials, 2);
                
                if (count($parts) === 2) {
                    $username = $parts[0];
                    $password = $parts[1];
                    
                    error_log("WP Sync Manager REST API: Attempting authentication for user: " . $username);
                    
                    $user = wp_authenticate($username, $password);
                    if (!is_wp_error($user) && user_can($user, 'manage_options')) {
                        wp_set_current_user($user->ID);
                        return true;
                    }
                }
            }
        }
        
        // Fallback to current user capabilities
        if (current_user_can('manage_options')) {
            return true;
        }
        
        error_log("WP Sync Manager REST API: Permission denied");
        return new WP_Error('rest_forbidden', 'Sorry, you are not allowed to access this resource.', array('status' => 401));
    }
}
