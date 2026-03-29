import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveLibraryConfig,
  listLibraryConfigs,
  loadLibraryConfig,
  type SaveLibraryConfigRequest,
  type LibraryConfigMetadata,
  type LoadLibraryConfigResponse,
} from '../services/api';

export const useLibrary = (filePath?: string) => {
  const queryClient = useQueryClient();

  // List all configs for a given file
  const {
    data: configs,
    isLoading: isLoadingConfigs,
    error: listError,
    refetch: refetchConfigs,
  } = useQuery<LibraryConfigMetadata[]>({
    queryKey: ['library', 'list', filePath],
    queryFn: async () => {
      if (!filePath) return [];
      const response = await listLibraryConfigs(filePath);
      return response.configs;
    },
    enabled: !!filePath, // Only run if filePath provided
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Save a config
  const saveMutation = useMutation({
    mutationFn: (config: SaveLibraryConfigRequest) => saveLibraryConfig(config),
    onSuccess: (data) => {
      // Invalidate and refetch configs list
      if (filePath) {
        queryClient.invalidateQueries({ queryKey: ['library', 'list', filePath] });
      }
      return data;
    },
  });

  // Load a config
  const loadMutation = useMutation<LoadLibraryConfigResponse, Error, string>({
    mutationFn: (configPath: string) => loadLibraryConfig(configPath),
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
