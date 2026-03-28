import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('App', () => {
  it('renders header with title', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('AI SDLC Orchestrator')).toBeInTheDocument();
  });

  it('renders all navigation tabs', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('Gates')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('DSL Editor')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows System Healthy chip', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('System Healthy')).toBeInTheDocument();
  });

  it('shows Development Environment subtitle', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('Development Environment')).toBeInTheDocument();
  });
});
