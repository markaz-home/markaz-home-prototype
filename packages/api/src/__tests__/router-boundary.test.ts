import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { adminAppRouter, webRouter } = await import('../root');

describe('deployment router boundaries', () => {
  it('does not mount Operations procedures in the customer/public app', () => {
    const procedures = Object.keys(webRouter._def.record);

    expect(procedures).not.toContain('admin');
    expect(procedures).not.toContain('audit');
  });

  it('does not mount customer marketplace mutations in the Operations app', () => {
    expect(Object.keys(adminAppRouter._def.record).sort()).toEqual(['admin', 'health']);
  });
});
