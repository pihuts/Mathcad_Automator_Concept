import type { FileMapping, InputConfig, MetaData, WorkflowFile } from '../services/api';

type AutoMappingMatch = {
  sourceFile: string;
  sourceAlias: string;
  sourceType: 'input' | 'output';
};

export type BuildAutoMappingsArgs = {
  orderedFiles: WorkflowFile[];
  filesMetadata: Record<string, MetaData | undefined>;
  existingMappings: FileMapping[];
  autoTargets: Set<string>;
  disabledTargets: Set<string>;
};

type ResolveMapping = (filePath: string, alias: string) => FileMapping | null;

const buildTargetKey = (filePath: string, alias: string): string => `${filePath}|${alias}`;

export const normalizeAlias = (alias: string): string => {
  return (alias || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
};

export const EXPERIMENTAL_INPUT_ALIAS = 'experimental_input';
export const EXPERIMENTAL_INPUT_NORMALIZED = normalizeAlias(EXPERIMENTAL_INPUT_ALIAS);

export const isExperimentalInputAlias = (alias: string): boolean => {
  return normalizeAlias(alias) === EXPERIMENTAL_INPUT_NORMALIZED;
};

export const hasManualValue = (input?: InputConfig): boolean => {
  if (!input) return false;
  if (input.csvSource) return true;

  const value = input.value;
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
};

const resolveChainedMatch = (
  mapping: FileMapping,
  resolveMapping: ResolveMapping
): AutoMappingMatch => {
  const visited = new Set<string>();
  let current: FileMapping | null = mapping;

  while (current) {
    const sourceType = (current.source_type ?? 'output') as 'input' | 'output';
    if (sourceType !== 'input') {
      return {
        sourceFile: current.source_file,
        sourceAlias: current.source_alias,
        sourceType,
      };
    }

    const key = buildTargetKey(current.source_file, current.source_alias);
    if (visited.has(key)) {
      return {
        sourceFile: current.source_file,
        sourceAlias: current.source_alias,
        sourceType: 'input',
      };
    }

    visited.add(key);
    const upstream = resolveMapping(current.source_file, current.source_alias);
    if (!upstream) {
      return {
        sourceFile: current.source_file,
        sourceAlias: current.source_alias,
        sourceType: 'input',
      };
    }
    current = upstream;
  }

  return {
    sourceFile: mapping.source_file,
    sourceAlias: mapping.source_alias,
    sourceType: (mapping.source_type ?? 'output') as 'input' | 'output',
  };
};

const findNearestUpstreamMatch = (
  orderedFiles: WorkflowFile[],
  filesMetadata: Record<string, MetaData | undefined>,
  targetIndex: number,
  targetAlias: string,
  resolveMapping: ResolveMapping
): AutoMappingMatch | null => {
  const normalizedTarget = normalizeAlias(targetAlias);

  for (let idx = targetIndex - 1; idx >= 0; idx -= 1) {
    const upstreamFile = orderedFiles[idx];
    const metadata = filesMetadata[upstreamFile.file_path];
    if (!metadata) continue;

    const inputs = metadata.inputs || [];
    for (const input of inputs) {
      if (normalizeAlias(input.alias) !== normalizedTarget) continue;
      const upstreamMapping = resolveMapping(upstreamFile.file_path, input.alias);
      if (upstreamMapping) {
        return resolveChainedMatch(upstreamMapping, resolveMapping);
      }
    }

    const outputs = metadata.outputs || [];
    for (const output of outputs) {
      if (normalizeAlias(output.alias) === normalizedTarget) {
        return {
          sourceFile: upstreamFile.file_path,
          sourceAlias: output.alias,
          sourceType: 'output',
        };
      }
    }

    for (const input of inputs) {
      if (normalizeAlias(input.alias) === normalizedTarget) {
        return {
          sourceFile: upstreamFile.file_path,
          sourceAlias: input.alias,
          sourceType: 'input',
        };
      }
    }
  }

  return null;
};

export const buildAutoMappings = ({
  orderedFiles,
  filesMetadata,
  existingMappings,
  autoTargets,
  disabledTargets,
}: BuildAutoMappingsArgs): { nextMappings: FileMapping[]; nextAutoTargets: Set<string> } => {
  const existingByTarget = new Map<string, FileMapping>();
  existingMappings.forEach((mapping) => {
    existingByTarget.set(buildTargetKey(mapping.target_file, mapping.target_alias), mapping);
  });

  const stepsMissingMetadata = new Set<string>();
  orderedFiles.forEach((file) => {
    if (!filesMetadata[file.file_path]) {
      stepsMissingMetadata.add(file.file_path);
    }
  });

  const inputConfigByTarget = new Map<string, InputConfig | undefined>();
  orderedFiles.forEach((file) => {
    file.inputs?.forEach((input) => {
      inputConfigByTarget.set(buildTargetKey(file.file_path, input.alias), input);
    });
  });

  const shouldUseAutoTargetForChaining = (filePath: string, alias: string): boolean => {
    const key = buildTargetKey(filePath, alias);
    if (stepsMissingMetadata.has(filePath)) return true;
    if (disabledTargets.has(key)) return false;
    if (isExperimentalInputAlias(alias)) return false;
    const inputConfig = inputConfigByTarget.get(key);
    return !hasManualValue(inputConfig);
  };

  const autoMappingQueue: Array<{ key: string; mapping: FileMapping }> = [];
  const autoMappingByTarget = new Map<string, FileMapping>();

  const resolveMapping: ResolveMapping = (filePath, alias) => {
    const key = buildTargetKey(filePath, alias);
    const autoMapping = autoMappingByTarget.get(key);
    if (autoMapping) return autoMapping;

    const existingMapping = existingByTarget.get(key);
    if (!existingMapping) return null;
    if (autoTargets.has(key) && !shouldUseAutoTargetForChaining(filePath, alias)) return null;
    return existingMapping;
  };

  orderedFiles.forEach((file, fileIndex) => {
    const metadata = filesMetadata[file.file_path];
    if (!metadata?.inputs) return;

    metadata.inputs.forEach((input) => {
      const targetKey = buildTargetKey(file.file_path, input.alias);

      if (isExperimentalInputAlias(input.alias)) return;
      if (disabledTargets.has(targetKey)) return;

      const existingMapping = existingByTarget.get(targetKey);
      if (existingMapping && !autoTargets.has(targetKey)) {
        return;
      }

      const inputConfig = file.inputs?.find((ic) => ic.alias === input.alias);
      if (hasManualValue(inputConfig)) {
        return;
      }

      const match = findNearestUpstreamMatch(orderedFiles, filesMetadata, fileIndex, input.alias, resolveMapping);
      if (!match) {
        return;
      }

      const mapping: FileMapping = {
        source_file: match.sourceFile,
        source_alias: match.sourceAlias,
        source_type: match.sourceType,
        target_file: file.file_path,
        target_alias: input.alias,
        units: existingMapping?.units,
      };

      autoMappingQueue.push({
        key: targetKey,
        mapping,
      });
      autoMappingByTarget.set(targetKey, mapping);
    });
  });

  const nextMappings: FileMapping[] = [];
  const nextAutoTargets = new Set<string>();

  existingMappings.forEach((mapping) => {
    const key = buildTargetKey(mapping.target_file, mapping.target_alias);
    if (stepsMissingMetadata.has(mapping.target_file)) {
      nextMappings.push(mapping);
      if (autoTargets.has(key)) {
        nextAutoTargets.add(key);
      }
      return;
    }
    const autoMapping = autoMappingByTarget.get(key);
    if (autoMapping) {
      nextMappings.push(autoMapping);
      nextAutoTargets.add(key);
      autoMappingByTarget.delete(key);
      return;
    }

    if (!autoTargets.has(key)) {
      nextMappings.push(mapping);
    }
  });

  autoMappingQueue.forEach(({ key, mapping }) => {
    if (nextAutoTargets.has(key)) return;
    if (!autoMappingByTarget.has(key)) return;
    nextMappings.push(mapping);
    nextAutoTargets.add(key);
  });

  return { nextMappings, nextAutoTargets };
};
