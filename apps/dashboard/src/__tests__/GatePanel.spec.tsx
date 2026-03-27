import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GatePanel } from '../components/GatePanel';

const mockGateData = {
  items: [
    {
      id: 'wf-1',
      dslName: 'Review login fix',
      state: 'implementing',
      temporalWorkflowId: 'twf-1',
      repoUrl: 'https://github.com/org/repo',
    },
  ],
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
      <GatePanel />
    </QueryClientProvider>,
  );
}

describe('GatePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <GatePanel />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading gate requests...')).toBeInTheDocument();
  });

  it('should render gate workflows', async () => {
    renderWithQuery(mockGateData);
    expect(await screen.findByText('Review login fix')).toBeInTheDocument();
    expect(screen.getByText('Gate Approvals (1)')).toBeInTheDocument();
  });

  it('should show approve and reject buttons', async () => {
    renderWithQuery(mockGateData);
    expect(await screen.findByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('should show empty state when no approvals', async () => {
    renderWithQuery({ items: [] });
    expect(await screen.findByText('No workflows awaiting approval')).toBeInTheDocument();
  });

  it('should show comment input', async () => {
    renderWithQuery(mockGateData);
    expect(await screen.findByPlaceholderText('Comment (optional)')).toBeInTheDocument();
  });

  it('should show temporal workflow id', async () => {
    renderWithQuery(mockGateData);
    expect(await screen.findByText('twf-1')).toBeInTheDocument();
  });
});
