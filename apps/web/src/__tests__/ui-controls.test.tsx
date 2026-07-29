import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

const h = vi.hoisted(() => ({
  locationQuery: {
    data: [] as Array<{ id: string; name: string; level: string; context: string }>,
    isFetching: false,
    isFetched: true,
    isError: false,
  },
}));

vi.mock('@/trpc/react', () => ({
  trpc: {
    externalProperties: {
      locations: {
        useQuery: () => h.locationQuery,
      },
    },
  },
}));

import { PlaceCombobox } from '@/components/ui/place-combobox';
import { ListboxSelect } from '@/components/ui/listbox-select';

function ControlledPlace() {
  const [value, setValue] = useState('Du');
  return <PlaceCombobox id="place" value={value} onChange={setValue} />;
}

function renderIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  h.locationQuery.data = [];
  h.locationQuery.isFetching = false;
  h.locationQuery.isFetched = true;
  h.locationQuery.isError = false;
});

describe('PlaceCombobox', () => {
  it('does not select or crash when keyboard navigation has no suggestions', async () => {
    const user = userEvent.setup();
    renderIntl(<ControlledPlace />);
    const input = screen.getByRole('combobox');

    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(input).toHaveValue('Du');
    expect(screen.getByText('No matches. You can type your own.')).toBeInTheDocument();
  });

  it('shows a recoverable provider error while preserving free text', async () => {
    const user = userEvent.setup();
    h.locationQuery.isError = true;
    renderIntl(<ControlledPlace />);
    await user.click(screen.getByRole('combobox'));

    expect(
      await screen.findByText(
        'Suggestions are temporarily unavailable. You can still type your own.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ListboxSelect', () => {
  it('moves focus into the listbox and returns it after keyboard selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ListboxSelect
        value="APARTMENT"
        onChange={onChange}
        ariaLabel="Property type"
        options={[
          { value: 'APARTMENT', label: 'Apartment' },
          { value: 'VILLA', label: 'Villa' },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Property type' });
    await user.click(trigger);
    const listbox = screen.getByRole('listbox');
    await waitFor(() => expect(listbox).toHaveFocus());

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('VILLA');
    expect(trigger).toHaveFocus();
  });
});
