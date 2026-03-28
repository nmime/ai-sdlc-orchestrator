import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { DslEditor } from '../components/DslEditor';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('DslEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  });

  it('renders title', () => {
    renderWithProviders(<DslEditor />);
    expect(screen.getByText('DSL Editor')).toBeInTheDocument();
  });

  it('renders validate and save buttons', () => {
    renderWithProviders(<DslEditor />);
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Save DSL')).toBeInTheDocument();
  });

  it('renders code textarea', () => {
    renderWithProviders(<DslEditor />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeDefined();
    expect(textarea?.value).toContain('name: my-workflow');
  });
});
