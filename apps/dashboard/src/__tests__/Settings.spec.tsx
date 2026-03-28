import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { Settings } from '../components/Settings';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and description', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Connection Settings')).toBeInTheDocument();
  });

  it('renders save button', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
  });
});
