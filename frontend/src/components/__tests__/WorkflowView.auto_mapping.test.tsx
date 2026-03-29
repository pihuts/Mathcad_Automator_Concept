import { describe, expect, it } from 'vitest';
import type { InputConfig, MetaData, WorkflowFile, FileMapping } from '../../services/api';
import { buildAutoMappings } from '../../utils/workflowAutoMapping';

const makeFile = (filePath: string, position: number, inputs: InputConfig[] = []): WorkflowFile => ({
  file_path: filePath,
  inputs,
  position,
});

const makeMetadata = (inputs: string[] = [], outputs: string[] = []): MetaData => ({
  inputs: inputs.map((alias) => ({ alias, name: alias })),
  outputs: outputs.map((alias) => ({ alias, name: alias })),
});

const targetKey = (filePath: string, alias: string) => `${filePath}|${alias}`;

describe('buildAutoMappings', () => {
  it('follows upstream input mappings when a chain exists', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1),
      makeFile('step-3.mcdx', 2, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['Load']),
      'step-2.mcdx': makeMetadata(['Load'], ['Load']),
      'step-3.mcdx': makeMetadata(['load'], []),
    };

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    const mappingForStep3 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-3.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep3).toBeTruthy();
    expect(mappingForStep3).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'Load',
      source_type: 'output',
      target_file: 'step-3.mcdx',
      target_alias: 'load',
    });
    expect(nextAutoTargets.has(targetKey('step-3.mcdx', 'load'))).toBe(true);
  });

  it('chains through existing auto mappings to the original upstream source', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [{ alias: 'load', value: null }]),
      makeFile('step-3.mcdx', 2, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['load']),
      'step-2.mcdx': makeMetadata(['load'], ['load']),
      'step-3.mcdx': makeMetadata(['load'], []),
    };
    const existingMappings: FileMapping[] = [
      {
        source_file: 'step-1.mcdx',
        source_alias: 'load',
        source_type: 'output',
        target_file: 'step-2.mcdx',
        target_alias: 'load',
      },
    ];

    const { nextMappings } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings,
      autoTargets: new Set([targetKey('step-2.mcdx', 'load')]),
      disabledTargets: new Set(),
    });

    const mappingForStep3 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-3.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep3).toBeTruthy();
    expect(mappingForStep3).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'load',
      source_type: 'output',
      target_file: 'step-3.mcdx',
      target_alias: 'load',
    });
  });

  it('chains through manual input mappings across longer chains', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [{ alias: 'load', value: null }]),
      makeFile('step-3.mcdx', 2, [{ alias: 'load', value: null }]),
      makeFile('step-4.mcdx', 3, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['load']),
      'step-2.mcdx': makeMetadata(['load'], ['load']),
      'step-3.mcdx': makeMetadata(['load'], ['load']),
      'step-4.mcdx': makeMetadata(['load'], []),
    };
    const existingMappings: FileMapping[] = [
      {
        source_file: 'step-1.mcdx',
        source_alias: 'load',
        source_type: 'output',
        target_file: 'step-2.mcdx',
        target_alias: 'load',
      },
      {
        source_file: 'step-2.mcdx',
        source_alias: 'load',
        source_type: 'input',
        target_file: 'step-3.mcdx',
        target_alias: 'load',
      },
    ];

    const { nextMappings } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings,
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    const mappingForStep4 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-4.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep4).toBeTruthy();
    expect(mappingForStep4).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'load',
      source_type: 'output',
      target_file: 'step-4.mcdx',
      target_alias: 'load',
    });
  });

  it('prefers nearest upstream output when upstream input is not mapped', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [{ alias: 'load', value: 10 }]),
      makeFile('step-3.mcdx', 2, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['load']),
      'step-2.mcdx': makeMetadata(['load'], ['load']),
      'step-3.mcdx': makeMetadata(['load'], []),
    };

    const { nextMappings } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    const mappingForStep3 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-3.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep3).toBeTruthy();
    expect(mappingForStep3).toMatchObject({
      source_file: 'step-2.mcdx',
      source_alias: 'load',
      source_type: 'output',
      target_file: 'step-3.mcdx',
      target_alias: 'load',
    });
  });

  it('chains through manual mappings to the original upstream source', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1),
      makeFile('step-3.mcdx', 2, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata(['Load'], []),
      'step-2.mcdx': makeMetadata(['Load'], ['Load']),
      'step-3.mcdx': makeMetadata(['load'], []),
    };
    const existingMappings: FileMapping[] = [
      {
        source_file: 'step-1.mcdx',
        source_alias: 'Load',
        source_type: 'input',
        target_file: 'step-2.mcdx',
        target_alias: 'Load',
      },
    ];

    const { nextMappings } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings,
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    const mappingForStep3 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-3.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep3).toBeTruthy();
    expect(mappingForStep3).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'Load',
      source_type: 'input',
      target_file: 'step-3.mcdx',
      target_alias: 'load',
    });
  });

  it('propagates auto-mapping chains across multiple steps', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1),
      makeFile('step-3.mcdx', 2),
      makeFile('step-4.mcdx', 3, [{ alias: 'load', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['load']),
      'step-2.mcdx': makeMetadata(['load'], ['load']),
      'step-3.mcdx': makeMetadata(['load'], ['load']),
      'step-4.mcdx': makeMetadata(['load'], []),
    };

    const { nextMappings } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    const mappingForStep3 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-3.mcdx' && mapping.target_alias === 'load'
    );
    const mappingForStep4 = nextMappings.find(
      (mapping) => mapping.target_file === 'step-4.mcdx' && mapping.target_alias === 'load'
    );

    expect(mappingForStep3).toBeTruthy();
    expect(mappingForStep3).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'load',
      source_type: 'output',
      target_file: 'step-3.mcdx',
      target_alias: 'load',
    });
    expect(mappingForStep4).toBeTruthy();
    expect(mappingForStep4).toMatchObject({
      source_file: 'step-1.mcdx',
      source_alias: 'load',
      source_type: 'output',
      target_file: 'step-4.mcdx',
      target_alias: 'load',
    });
  });

  it('skips auto-mapping for manual values and CSV sources', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [
        { alias: 'alpha', value: 12 },
        { alias: 'beta', value: null, csvSource: { fileId: 'csv-1', column: 'B' } },
      ]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['alpha', 'beta']),
      'step-2.mcdx': makeMetadata(['alpha', 'beta'], []),
    };

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    expect(nextMappings).toHaveLength(0);
    expect(nextAutoTargets.size).toBe(0);
  });

  it('does not override manual mappings that are not marked as auto', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1),
      makeFile('step-3.mcdx', 2, [{ alias: 'flow', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['flow']),
      'step-2.mcdx': makeMetadata([], ['flow']),
      'step-3.mcdx': makeMetadata(['flow'], []),
    };
    const existingMappings: FileMapping[] = [
      {
        source_file: 'step-1.mcdx',
        source_alias: 'flow',
        source_type: 'output',
        target_file: 'step-3.mcdx',
        target_alias: 'flow',
      },
    ];

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings,
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    expect(nextMappings).toHaveLength(1);
    expect(nextMappings[0].source_file).toBe('step-1.mcdx');
    expect(nextAutoTargets.has(targetKey('step-3.mcdx', 'flow'))).toBe(false);
  });

  it('respects disabled targets and leaves them unmapped', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [{ alias: 'temp', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['temp']),
      'step-2.mcdx': makeMetadata(['temp'], []),
    };

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set([targetKey('step-2.mcdx', 'temp')]),
    });

    expect(nextMappings).toHaveLength(0);
    expect(nextAutoTargets.size).toBe(0);
  });

  it('skips auto-mapping for experimental_input', () => {
    const orderedFiles = [
      makeFile('step-1.mcdx', 0),
      makeFile('step-2.mcdx', 1, [{ alias: 'experimental_input', value: null }]),
    ];
    const filesMetadata: Record<string, MetaData> = {
      'step-1.mcdx': makeMetadata([], ['experimental_input']),
      'step-2.mcdx': makeMetadata(['experimental_input'], []),
    };

    const { nextMappings, nextAutoTargets } = buildAutoMappings({
      orderedFiles,
      filesMetadata,
      existingMappings: [],
      autoTargets: new Set(),
      disabledTargets: new Set(),
    });

    expect(nextMappings).toHaveLength(0);
    expect(nextAutoTargets.size).toBe(0);
  });
});
