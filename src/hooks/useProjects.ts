
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
      const { data, error } = await supabase
        .from('wp_environments')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      
      const envMap: { live?: WPEnvironment; dev?: WPEnvironment } = {};
      data?.forEach(env => {
        envMap[env.environment_type as 'live' | 'dev'] = env as WPEnvironment;
      });
      
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
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from('wp_environments')
        .upsert({
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
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      setEnvironments(prev => ({
        ...prev,
        [environmentType]: data as WPEnvironment
      }));
      
      toast({
        title: "Success",
        description: `${environmentType} environment updated successfully`,
      });
      
      return data;
    } catch (error) {
      console.error('Error updating environment:', error);
      toast({
        title: "Error",
        description: `Failed to update ${environmentType} environment`,
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
