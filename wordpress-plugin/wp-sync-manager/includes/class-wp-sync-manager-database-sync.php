
<?php
/**
 * Database sync operations
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class WP_Sync_Manager_Database_Sync {
    
    public function sync_database($selected_tables, $operation_type, $target_url, $target_credentials) {
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
    
    private function push_database_table($table_name, $target_url, $target_credentials) {
        global $wpdb;
        
        // Export table structure and data
        $table_sql = $this->export_table_sql($table_name);
        
        // Send to target environment
        $communicator = new WP_Sync_Manager_Network_Communicator();
        return $communicator->send_table_to_target($table_sql, $table_name, $target_url, $target_credentials);
    }
    
    private function pull_database_table($table_name, $target_url, $target_credentials) {
        $communicator = new WP_Sync_Manager_Network_Communicator();
        $table_sql = $communicator->request_table_from_target($table_name, $target_url, $target_credentials);
        return $this->import_table_sql($table_sql, $table_name);
    }
    
    public function export_table_sql($table_name) {
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
    
    public function import_table_sql($sql, $table_name) {
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
}
