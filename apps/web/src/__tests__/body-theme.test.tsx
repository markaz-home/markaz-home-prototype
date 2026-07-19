import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BodyTheme } from '@/components/theme/body-theme';

afterEach(() => {
  document.body.className = '';
});

describe('BodyTheme', () => {
  it('themes portaled UI while mounted and cleans up after unmount', () => {
    const view = render(<BodyTheme className="theme-platform-gold" />);

    expect(document.body).toHaveClass('theme-platform-gold');

    view.unmount();
    expect(document.body).not.toHaveClass('theme-platform-gold');
  });

  it('keeps the class until all matching theme boundaries unmount', () => {
    const first = render(<BodyTheme className="theme-platform-gold" />);
    const second = render(<BodyTheme className="theme-platform-gold" />);

    first.unmount();
    expect(document.body).toHaveClass('theme-platform-gold');

    second.unmount();
    expect(document.body).not.toHaveClass('theme-platform-gold');
  });
});
