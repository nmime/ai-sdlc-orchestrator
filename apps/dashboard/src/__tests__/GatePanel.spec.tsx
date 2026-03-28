import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { GatePanel } from '../components/GatePanel';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('GatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    renderWithProviders(<GatePanel />);
    expect(await screen.findByText('Gate Approvals')).toBeInTheDocument();
  });

  it('shows empty state when no gates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    renderWithProviders(<GatePanel />);
    expect(await screen.findByText(/all clear/i)).toBeInTheDocument();
  });
});
