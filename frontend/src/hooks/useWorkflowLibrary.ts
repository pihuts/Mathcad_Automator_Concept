import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveWorkflowLibraryConfig,
  listWorkflowLibraryConfigs,
  loadWorkflowLibraryConfig,
  type SaveWorkflowLibraryConfigRequest,
  type WorkflowLibraryConfigMetadata,
} from '../services/api';

export const useWorkflowLibrary = () => {
  const queryClient = useQueryClient();

  // List all workflow configs
  const {
    data: configs,
    isLoading: isLoadingConfigs,
    error: listError,
    refetch: refetchConfigs,
  } = useQuery<WorkflowLibraryConfigMetadata[]>({
    queryKey: ['library', 'workflows'],
    queryFn: async () => {
      const response = await listWorkflowLibraryConfigs();
      return response.configs;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Save a workflow config
  const saveMutation = useMutation({
    mutationFn: (config: SaveWorkflowLibraryConfigRequest) => saveWorkflowLibraryConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'workflows'] });
    },
  });

  // Load a workflow config
  const loadMutation = useMutation({
    mutationFn: (configPath: string) => loadWorkflowLibraryConfig(configPath),
  });

  return {
    // List configs
    configs,
    isLoadingConfigs,
    listError,
    refetchConfigs,

    // Save config
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
    saveResult: saveMutation.data,

    // Load config
    loadConfig: loadMutation.mutate,
    isLoadingConfig: loadMutation.isPending,
    loadError: loadMutation.error,
    loadedConfig: loadMutation.data,
  };
};
