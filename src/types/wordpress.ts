
export interface WordPressPlugin {
  name: string;
  slug: string;
  version: string;
  status: 'active' | 'inactive';
  update_available: boolean;
  description?: string;
}

export interface WordPressTheme {
  name: string;
  slug: string;
  version: string;
  status: 'active' | 'inactive';
  update_available: boolean;
  description?: string;
}

export interface WordPressTable {
  name: string;
  rows: number;
  size: string;
  engine: string;
}

export interface WordPressData {
  plugins: WordPressPlugin[];
  themes: WordPressTheme[];
  tables: WordPressTable[];
  media_count: number;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
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
  db_host?: string;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  status: 'connected' | 'disconnected' | 'error';
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
}
