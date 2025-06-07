
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, WPEnvironment } from '@/types/wordpress';
import { useToast } from '@/hooks/use-toast';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [environments, setEnvironments] = useState<{ live?: WPEnvironment; dev?: WPEnvironment }>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
      
      // Auto-select first project if available
      if (data && data.length > 0 && !currentProject) {
        setCurrentProject(data[0]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvironments = async (projectId: string) => {
    try {
      console.log('Fetching environments for project:', projectId);
      const { data, error } = await supabase
        .from('wp_environments')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      
      console.log('Fetched environments data:', data);
      
      const envMap: { live?: WPEnvironment; dev?: WPEnvironment } = {};
      data?.forEach(env => {
        envMap[env.environment_type as 'live' | 'dev'] = env as WPEnvironment;
      });
      
      console.log('Environment map created:', envMap);
      setEnvironments(envMap);
    } catch (error) {
      console.error('Error fetching environments:', error);
      toast({
        title: "Error",
        description: "Failed to load environments",
        variant: "destructive",
      });
    }
  };

  const createProject = async (name: string, description?: string): Promise<Project> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert([{ name, description, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setProjects(prev => [data, ...prev]);
      setCurrentProject(data);
      
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateEnvironment = async (
    projectId: string,
    environmentType: 'live' | 'dev',
    config: { 
      name: string; 
      url: string; 
      username: string; 
      password: string;
      db_host?: string;
      db_name?: string;
      db_user?: string;
      db_password?: string;
      ssh_host?: string;
      ssh_port?: number;
      ssh_username?: string;
      ssh_password?: string;
      ssh_private_key?: string;
      wp_cli_path?: string;
      wp_root_path?: string;
    }
  ) => {
    try {
      console.log('=== UPDATE ENVIRONMENT DEBUG ===');
      console.log('Project ID:', projectId);
      console.log('Environment Type:', environmentType);
      console.log('Config received:', config);
      
      // Check if environment already exists
      const { data: existingEnv, error: fetchError } = await supabase
        .from('wp_environments')
        .select('*')
        .eq('project_id', projectId)
        .eq('environment_type', environmentType)
        .single();
      
      console.log('Existing environment:', existingEnv);
      console.log('Fetch error:', fetchError);
      
      const environmentData = {
        project_id: projectId,
        environment_type: environmentType,
        name: config.name,
        url: config.url,
        username: config.username,
        password: config.password,
        db_host: config.db_host || null,
        db_name: config.db_name || null,
        db_user: config.db_user || null,
        db_password: config.db_password || null,
        ssh_host: config.ssh_host || null,
        ssh_port: config.ssh_port || 22,
        ssh_username: config.ssh_username || null,
        ssh_password: config.ssh_password || null,
        ssh_private_key: config.ssh_private_key || null,
        wp_cli_path: config.wp_cli_path || '/usr/local/bin/wp',
        wp_root_path: config.wp_root_path || '/var/www/html',
        updated_at: new Date().toISOString()
      };
      
      console.log('Data to be saved:', environmentData);
      
      let data, error;
      
      if (existingEnv) {
        // Update existing environment
        console.log('Updating existing environment with ID:', existingEnv.id);
        const result = await supabase
          .from('wp_environments')
          .update(environmentData)
          .eq('id', existingEnv.id)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } else {
        // Insert new environment
        console.log('Inserting new environment');
        const result = await supabase
          .from('wp_environments')
          .insert(environmentData)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      }
      
      console.log('Supabase operation result - data:', data);
      console.log('Supabase operation result - error:', error);

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      
      // Update local state
      setEnvironments(prev => ({
        ...prev,
        [environmentType]: data as WPEnvironment
      }));
      
      console.log('Environment updated successfully:', data);
      
      toast({
        title: "Success",
        description: `${environmentType} environment updated successfully`,
      });
      
      // Refetch environments to ensure consistency
      await fetchEnvironments(projectId);
      
      return data;
    } catch (error) {
      console.error('=== UPDATE ENVIRONMENT ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      
      toast({
        title: "Error",
        description: `Failed to update ${environmentType} environment: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      fetchEnvironments(currentProject.id);
    }
  }, [currentProject]);

  return {
    projects,
    currentProject,
    environments,
    loading,
    setCurrentProject,
    createProject,
    updateEnvironment,
    fetchProjects,
    fetchEnvironments
  };
};
