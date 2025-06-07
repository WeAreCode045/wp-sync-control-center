
export interface Project {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface WPEnvironment {
  id: string;
  project_id: string;
  environment_type: 'live' | 'dev';
  name: string;
  url: string;
  username: string;
  password: string;
  status?: 'connected' | 'disconnected' | 'error';
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
  
  // Database credentials
  db_host?: string;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  
  // SSH and WP-CLI configuration
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_private_key?: string;
  wp_cli_path?: string;
  wp_root_path?: string;
}

export interface SyncOperation {
  id: string;
  project_id: string;
  operation_type: 'push' | 'pull';
  source_environment: string;
  target_environment: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  components: {
    plugins: { selected: string[] };
    themes: { selected: string[] };
    database: { selected: string[] };
    media: boolean;
  };
  created_by: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}
