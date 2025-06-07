
<?php
/**
 * SSH operations for file synchronization
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_SSH_Handler {
    
    private $ssh_connection = null;
    private $ssh_config = array();
    
    public function __construct($ssh_config = array()) {
        $this->ssh_config = $ssh_config;
    }
    
    public function test_ssh_connection($target_credentials) {
        if (!$this->has_ssh_config($target_credentials)) {
            return false;
        }
        
        try {
            $connection = $this->establish_ssh_connection($target_credentials);
            if ($connection) {
                $this->close_ssh_connection();
                return true;
            }
        } catch (Exception $e) {
            error_log('SSH connection test failed: ' . $e->getMessage());
        }
        
        return false;
    }
    
    public function sync_directory_via_ssh($local_path, $remote_path, $target_credentials, $operation_type = 'push') {
        if (!$this->establish_ssh_connection($target_credentials)) {
            throw new Exception('Failed to establish SSH connection');
        }
        
        try {
            if ($operation_type === 'push') {
                return $this->rsync_push($local_path, $remote_path, $target_credentials);
            } else {
                return $this->rsync_pull($local_path, $remote_path, $target_credentials);
            }
        } finally {
            $this->close_ssh_connection();
        }
    }
    
    private function has_ssh_config($target_credentials) {
        return !empty($target_credentials['ssh_host']) && 
               !empty($target_credentials['ssh_username']);
    }
    
    private function establish_ssh_connection($target_credentials) {
        if (!function_exists('ssh2_connect')) {
            throw new Exception('SSH2 extension not available. Please install php-ssh2 or use REST API fallback.');
        }
        
        $this->ssh_connection = ssh2_connect(
            $target_credentials['ssh_host'], 
            isset($target_credentials['ssh_port']) ? $target_credentials['ssh_port'] : 22
        );
        
        if (!$this->ssh_connection) {
            throw new Exception('Failed to connect to SSH server');
        }
        
        // Try key-based authentication first, then password
        if (!empty($target_credentials['ssh_private_key'])) {
            $auth_result = ssh2_auth_pubkey_file(
                $this->ssh_connection,
                $target_credentials['ssh_username'],
                $target_credentials['ssh_public_key'] ?? null,
                $target_credentials['ssh_private_key']
            );
        } else {
            $auth_result = ssh2_auth_password(
                $this->ssh_connection,
                $target_credentials['ssh_username'],
                $target_credentials['ssh_password'] ?? ''
            );
        }
        
        if (!$auth_result) {
            throw new Exception('SSH authentication failed');
        }
        
        return $this->ssh_connection;
    }
    
    private function rsync_push($local_path, $remote_path, $target_credentials) {
        $remote_string = sprintf(
            '%s@%s:%s',
            $target_credentials['ssh_username'],
            $target_credentials['ssh_host'],
            $remote_path
        );
        
        $command = sprintf(
            'rsync -avz --delete -e "ssh -p %d" %s %s',
            isset($target_credentials['ssh_port']) ? $target_credentials['ssh_port'] : 22,
            escapeshellarg(rtrim($local_path, '/') . '/'),
            escapeshellarg($remote_string)
        );
        
        return $this->execute_rsync_command($command);
    }
    
    private function rsync_pull($local_path, $remote_path, $target_credentials) {
        $remote_string = sprintf(
            '%s@%s:%s',
            $target_credentials['ssh_username'],
            $target_credentials['ssh_host'],
            $remote_path
        );
        
        $command = sprintf(
            'rsync -avz --delete -e "ssh -p %d" %s %s',
            isset($target_credentials['ssh_port']) ? $target_credentials['ssh_port'] : 22,
            escapeshellarg(rtrim($remote_string, '/') . '/'),
            escapeshellarg(rtrim($local_path, '/') . '/')
        );
        
        return $this->execute_rsync_command($command);
    }
    
    private function execute_rsync_command($command) {
        $output = array();
        $return_code = 0;
        
        exec($command . ' 2>&1', $output, $return_code);
        
        if ($return_code !== 0) {
            throw new Exception('Rsync failed: ' . implode("\n", $output));
        }
        
        return array(
            'success' => true,
            'output' => $output,
            'method' => 'rsync'
        );
    }
    
    public function execute_remote_command($command, $target_credentials) {
        if (!$this->establish_ssh_connection($target_credentials)) {
            throw new Exception('Failed to establish SSH connection');
        }
        
        try {
            $stream = ssh2_exec($this->ssh_connection, $command);
            if (!$stream) {
                throw new Exception('Failed to execute remote command');
            }
            
            stream_set_blocking($stream, true);
            $output = stream_get_contents($stream);
            fclose($stream);
            
            return $output;
        } finally {
            $this->close_ssh_connection();
        }
    }
    
    private function close_ssh_connection() {
        if ($this->ssh_connection) {
            // SSH2 connections are automatically closed when the resource is freed
            $this->ssh_connection = null;
        }
    }
    
    public function get_remote_wp_path($target_credentials) {
        try {
            $wp_config_search = "find /var/www /home -name 'wp-config.php' 2>/dev/null | head -1";
            $wp_config_path = trim($this->execute_remote_command($wp_config_search, $target_credentials));
            
            if ($wp_config_path) {
                return dirname($wp_config_path);
            }
            
            // Fallback to configured path
            return $target_credentials['wp_root_path'] ?? '/var/www/html';
        } catch (Exception $e) {
            // Return default path if remote command fails
            return $target_credentials['wp_root_path'] ?? '/var/www/html';
        }
    }
}
