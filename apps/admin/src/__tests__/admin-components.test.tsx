import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { RESTRICT_REASONS } from '@markaz/domain';
import { renderWithIntl } from './test-utils';
import { StatusBadge } from '@/components/admin/status-badge';
import { ReasonSelect } from '@/components/admin/reason-select';
import { ActionDialog } from '@/components/admin/action-dialog';
import { Field } from '@/components/admin/detail';

describe('StatusBadge (spec §37 — text + icon, never colour-only)', () => {
  it('renders the label text alongside an icon', () => {
    const { container } = renderWithIntl(<StatusBadge tone="failed" label="Failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    // an inline svg icon accompanies the text so the state is not conveyed by colour alone
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('ReasonSelect (spec §37 — no hidden default)', () => {
  it('forces an explicit choice with an empty first option and lists every approved reason', () => {
    renderWithIntl(
      <ReasonSelect
        id="r"
        label="Reason"
        basePath="customer.restrict.reason"
        values={RESTRICT_REASONS}
        value=""
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText('Reason') as HTMLSelectElement;
    // first option is the empty placeholder, then one per reason
    expect(select.options[0]!.value).toBe('');
    expect(select.options.length).toBe(RESTRICT_REASONS.length + 1);
    expect(screen.getByRole('option', { name: 'Account under review' })).toBeInTheDocument();
  });

  it('emits the raw enum value on change', () => {
    const onChange = vi.fn();
    renderWithIntl(
      <ReasonSelect
        id="r"
        label="Reason"
        basePath="customer.restrict.reason"
        values={RESTRICT_REASONS}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'OTHER' } });
    expect(onChange).toHaveBeenCalledWith('OTHER');
  });
});

describe('ActionDialog (spec §37 — confirmation shell)', () => {
  it('opens on trigger, runs onSubmit, and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(
      <ActionDialog
        triggerLabel="Restrict"
        title="Restrict customer"
        body="This is recorded."
        submitLabel="Confirm"
        onSubmit={onSubmit}
      >
        <p>body content</p>
      </ActionDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restrict' }));
    expect(await screen.findByText('Restrict customer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Restrict customer')).not.toBeInTheDocument());
  });

  it('surfaces the error and stays open when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('ALREADY_RESTRICTED'));
    renderWithIntl(
      <ActionDialog
        triggerLabel="Restrict"
        title="Restrict customer"
        body="This is recorded."
        submitLabel="Confirm"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restrict' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('ALREADY_RESTRICTED')).toBeInTheDocument();
    expect(screen.getByText('Restrict customer')).toBeInTheDocument();
  });

  it('disables the submit button when canSubmit is false', async () => {
    renderWithIntl(
      <ActionDialog
        triggerLabel="Open"
        title="T"
        body="B"
        submitLabel="Go"
        canSubmit={false}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('button', { name: 'Go' })).toBeDisabled();
  });
});

describe('Field (detail primitive)', () => {
  it('renders a dash for a null value and sets LTR dir for references', () => {
    const { container } = renderWithIntl(<Field label="Reference" value={null} ltr />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy();
  });
});
