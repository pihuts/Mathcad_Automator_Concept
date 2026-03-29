// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputConfigView } from '../InputConfigView';

afterEach(() => {
  cleanup();
});

describe('InputConfigView tab removal', () => {
  it('does not render manual value entry options for numeric inputs', async () => {
    render(
      <InputConfigView
        inputAlias="test_numeric"
        inputName="Test Numeric"
        inputType="numeric"
        stepPosition={0}
        upstreamOutputs={[]}
        onMappingChange={vi.fn()}
      />
    );

    // No manual mode toggle buttons exist
    expect(screen.queryByRole('button', { name: 'Manual value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Single Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Range' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull();
  });

  it('does not render manual value entry options for string inputs', async () => {
    render(
      <InputConfigView
        inputAlias="test_string"
        inputName="Test String"
        inputType="string"
        stepPosition={0}
        upstreamOutputs={[]}
        onMappingChange={vi.fn()}
      />
    );

    // No manual mode toggle buttons exist
    expect(screen.queryByRole('button', { name: 'Manual value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Single Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull();
  });

  it('shows mapping UI directly for numeric inputs without toggle', async () => {
    render(
      <InputConfigView
        inputAlias="test_numeric"
        inputName="Test Numeric"
        inputType="numeric"
        stepPosition={0}
        upstreamOutputs={[
          {
            value: 'step-a.mcdx|pressure|input',
            label: 'pressure (input)',
            group: 'Step A',
          },
        ]}
        onMappingChange={vi.fn()}
        csvColumnsGrouped={[
          {
            group: 'Test File',
            columns: [
              { value: 'file1|pressure', label: 'pressure', preview: ['1.0', '2.0'] },
            ],
          },
        ]}
      />
    );

    // No manual mode toggle buttons
    expect(screen.queryByRole('button', { name: 'Manual value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Single Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Range' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull();

    // Mapping UI is shown directly (no toggle needed)
    expect(screen.getByText('SOURCE OUTPUT')).toBeTruthy();
    expect(screen.getByPlaceholderText('Select upstream output')).toBeTruthy();
  });

  it('shows mapping UI directly for string inputs without toggle', async () => {
    render(
      <InputConfigView
        inputAlias="test_string"
        inputName="Test String"
        inputType="string"
        stepPosition={0}
        upstreamOutputs={[
          {
            value: 'step-a.mcdx|pressure|input',
            label: 'pressure (input)',
            group: 'Step A',
          },
        ]}
        onMappingChange={vi.fn()}
      />
    );

    // No manual mode toggle buttons
    expect(screen.queryByRole('button', { name: 'Manual value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Single Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull();

    // Mapping UI is shown directly (no toggle needed)
    expect(screen.getByText('SOURCE OUTPUT')).toBeTruthy();
    expect(screen.getByPlaceholderText('Select upstream output')).toBeTruthy();
  });
});
