import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { WorkflowList } from '../components/WorkflowList';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('WorkflowList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });
    renderWithProviders(<WorkflowList />);
    expect(await screen.findByText('Workflows')).toBeInTheDocument();
  });

  it('shows empty state when no workflows', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });
    renderWithProviders(<WorkflowList />);
    expect(await screen.findByText(/no workflows/i)).toBeInTheDocument();
  });

  it('shows workflow data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          id: 'wf-1',
          taskTitle: 'Fix login bug',
          status: 'completed',
          repoUrl: 'https://github.com/test/repo',
          totalCostUsd: 1.5,
          startedAt: '2026-01-01T00:00:00Z',
        }],
        total: 1,
      }),
    });
    renderWithProviders(<WorkflowList />);
    expect(await screen.findByText('Fix login bug')).toBeInTheDocument();
  });
});
