// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputModal } from '../InputModal';

afterEach(() => {
  cleanup();
});

describe('InputModal tab structure', () => {
  it('renders CSV File, Range, and Upstream tabs for numeric inputs', async () => {
    render(
      <InputModal
        opened
        alias="test_numeric"
        onClose={() => {}}
        onSave={() => {}}
        onMappingChange={vi.fn()}
        upstreamOutputs={[
          {
            value: 'step-a.mcdx|pressure|input',
            label: 'pressure (input)',
            group: 'Step A',
          },
        ]}
      />
    );

    // Verify CSV File and Upstream tabs exist
    expect(screen.getByRole('tab', { name: 'CSV File' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Range' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Upstream' })).toBeTruthy();

    // Verify only Range is present among manual entry tabs for numeric inputs
    expect(screen.queryByRole('tab', { name: 'Constant' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'List' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Range' })).toBeTruthy();
  });

  it('renders only CSV File and Upstream tabs for string inputs', async () => {
    const user = userEvent.setup();

    render(
      <InputModal
        opened
        alias="test_string"
        onClose={() => {}}
        onSave={() => {}}
        onMappingChange={vi.fn()}
        upstreamOutputs={[
          {
            value: 'step-a.mcdx|pressure|input',
            label: 'pressure (input)',
            group: 'Step A',
          },
        ]}
      />
    );

    // Switch to string type
    await user.click(screen.getByRole('button', { name: 'String' }));

    // Verify CSV File and Upstream tabs exist
    expect(screen.getByRole('tab', { name: 'CSV File' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Upstream' })).toBeTruthy();

    // Verify manual value entry tabs are NOT present for string inputs
    expect(screen.queryByRole('tab', { name: 'Single' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'List' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Range' })).toBeNull();
  });

  it('does not render Constant, List, Range tabs for numeric input', async () => {
    render(
      <InputModal
        opened
        alias="test_number"
        onClose={() => {}}
        onSave={() => {}}
        onMappingChange={vi.fn()}
        upstreamOutputs={[]}
      />
    );

    // Confirm numeric type is selected (default)
    const tabs = screen.getAllByRole('tab');
    const tabNames = tabs.map(t => t.textContent);

    // Should contain Range but not other manual entry tabs
    expect(tabNames).not.toContain('Constant');
    expect(tabNames).not.toContain('List');
    expect(tabNames).toContain('Range');
  });

  it('does not render Single, List tabs for string input', async () => {
    const user = userEvent.setup();

    render(
      <InputModal
        opened
        alias="test_string"
        onClose={() => {}}
        onSave={() => {}}
        onMappingChange={vi.fn()}
        upstreamOutputs={[]}
      />
    );

    // Switch to string type
    await user.click(screen.getByRole('button', { name: 'String' }));

    const tabs = screen.getAllByRole('tab');
    const tabNames = tabs.map(t => t.textContent);

    // Should not contain manual entry tabs
    expect(tabNames).not.toContain('Single');
    expect(tabNames).not.toContain('List');
    expect(tabNames).not.toContain('Range');
  });

  it('saves numeric range values when Range tab is used', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <InputModal
        opened
        alias="test_range"
        onClose={() => {}}
        onSave={onSave}
        onMappingChange={vi.fn()}
        upstreamOutputs={[]}
      />
    );

    await user.click(screen.getByRole('tab', { name: 'Range' }));

    await user.type(screen.getByLabelText('Start'), '1');
    await user.type(screen.getByLabelText('End'), '3');
    await user.type(screen.getByLabelText('Step'), '1');

    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'test_range',
        value: [1, 2, 3],
        inputType: 'number',
      })
    );
  });
});
