import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('should render header', () => {
    renderApp();
    expect(screen.getByText('AI SDLC Orchestrator')).toBeInTheDocument();
  });

  it('should render navigation tabs', () => {
    renderApp();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('Gates')).toBeInTheDocument();
  });

  it('should default to workflows tab', () => {
    renderApp();
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('should switch to costs tab', () => {
    renderApp();
    fireEvent.click(screen.getByText('Costs'));
    expect(screen.getByText('Loading cost data...')).toBeInTheDocument();
  });

  it('should switch to gates tab', () => {
    renderApp();
    fireEvent.click(screen.getByText('Gates'));
    expect(screen.getByText('Loading gate requests...')).toBeInTheDocument();
  });
});
