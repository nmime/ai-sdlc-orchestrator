import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowList } from '../components/WorkflowList';

const mockWorkflows = {
  items: [
    {
      id: 'wf-1',
      dslName: 'Fix login bug',
      state: 'implementing',
      repoUrl: 'https://github.com/org/repo',
      costUsdTotal: 1.23,
      createdAt: '2025-01-01T00:00:00Z',
      temporalWorkflowId: 'twf-1',
    },
    {
      id: 'wf-2',
      dslName: 'Add auth',
      state: 'completed',
      repoUrl: 'https://github.com/org/repo2',
      costUsdTotal: 5.67,
      createdAt: '2025-01-02T00:00:00Z',
      temporalWorkflowId: 'twf-2',
    },
  ],
  total: 2,
};

function renderWithQuery(fetchResponse: any) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => fetchResponse,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowList />
    </QueryClientProvider>,
  );
}

describe('WorkflowList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowList />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('should render workflows after loading', async () => {
    renderWithQuery(mockWorkflows);
    expect(await screen.findByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Add auth')).toBeInTheDocument();
    expect(screen.getByText('Workflows (2)')).toBeInTheDocument();
  });

  it('should display cost for each workflow', async () => {
    renderWithQuery(mockWorkflows);
    expect(await screen.findByText('$1.23')).toBeInTheDocument();
    expect(screen.getByText('$5.67')).toBeInTheDocument();
  });

  it('should display status badges', async () => {
    renderWithQuery(mockWorkflows);
    expect(await screen.findByText('implementing')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('should show error state on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkflowList />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Error loading workflows')).toBeInTheDocument();
  });

  it('should show empty state when no workflows', async () => {
    renderWithQuery({ items: [], total: 0 });
    expect(await screen.findByText('Workflows (0)')).toBeInTheDocument();
  });
});
