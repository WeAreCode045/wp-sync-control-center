
<?php
/**
 * File handling operations for sync
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_File_Handler {
    
    public function create_zip_from_directory($source_dir, $zip_filename, $exclude_patterns = array()) {
        if (!class_exists('ZipArchive')) {
            throw new Exception('ZipArchive class is not available');
        }
        
        $zip = new ZipArchive();
        
        if ($zip->open($zip_filename, ZipArchive::CREATE) !== TRUE) {
            throw new Exception("Cannot create zip file: {$zip_filename}");
        }
        
        $this->add_directory_to_zip($zip, $source_dir, '', $exclude_patterns);
        $zip->close();
        
        return $zip_filename;
    }
    
    public function extract_zip_to_directory($zip_filename, $destination_dir) {
        if (!class_exists('ZipArchive')) {
            throw new Exception('ZipArchive class is not available');
        }
        
        $zip = new ZipArchive();
        
        if ($zip->open($zip_filename) !== TRUE) {
            throw new Exception("Cannot open zip file: {$zip_filename}");
        }
        
        if (!is_dir($destination_dir)) {
            wp_mkdir_p($destination_dir);
        }
        
        $zip->extractTo($destination_dir);
        $zip->close();
        
        return true;
    }
    
    private function add_directory_to_zip($zip, $dir, $zip_dir, $exclude_patterns = array()) {
        if (!is_dir($dir)) {
            return;
        }
        
        $files = scandir($dir);
        
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            
            $file_path = $dir . '/' . $file;
            $zip_path = $zip_dir ? $zip_dir . '/' . $file : $file;
            
            // Check if file should be excluded
            if ($this->should_exclude_file($file_path, $exclude_patterns)) {
                continue;
            }
            
            if (is_dir($file_path)) {
                $zip->addEmptyDir($zip_path);
                $this->add_directory_to_zip($zip, $file_path, $zip_path, $exclude_patterns);
            } else {
                $zip->addFile($file_path, $zip_path);
            }
        }
    }
    
    private function should_exclude_file($file_path, $exclude_patterns) {
        foreach ($exclude_patterns as $pattern) {
            if (fnmatch($pattern, $file_path)) {
                return true;
            }
        }
        
        // Default exclusions
        $default_exclusions = array(
            '*.log',
            '*.tmp',
            '*/.git/*',
            '*/.svn/*',
            '*/node_modules/*',
            '*/.DS_Store',
            '*/Thumbs.db'
        );
        
        foreach ($default_exclusions as $pattern) {
            if (fnmatch($pattern, $file_path)) {
                return true;
            }
        }
        
        return false;
    }
    
    public function get_temp_filename($prefix = 'wp_sync', $extension = '.zip') {
        return sys_get_temp_dir() . '/' . uniqid($prefix . '_') . $extension;
    }
    
    public function cleanup_temp_file($filename) {
        if (file_exists($filename)) {
            unlink($filename);
        }
    }
    
    public function validate_zip_file($zip_filename) {
        if (!file_exists($zip_filename)) {
            throw new Exception("Zip file does not exist: {$zip_filename}");
        }
        
        $zip = new ZipArchive();
        $result = $zip->open($zip_filename, ZipArchive::CHECKCONS);
        
        if ($result !== TRUE) {
            throw new Exception("Invalid zip file: {$zip_filename}");
        }
        
        $zip->close();
        return true;
    }
    
    public function get_directory_size($directory) {
        $size = 0;
        
        if (!is_dir($directory)) {
            return 0;
        }
        
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        
        foreach ($files as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }
        
        return $size;
    }
    
    public function format_bytes($size, $precision = 2) {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');
        
        for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
            $size /= 1024;
        }
        
        return round($size, $precision) . ' ' . $units[$i];
    }
}
