import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CostDashboard } from '../components/CostDashboard';

const mockCostData = {
  tenantId: '00000000-0000-4000-a000-000000000001',
  monthlyCostLimitUsd: 1000,
  monthlyCostActualUsd: 250,
  monthlyCostReservedUsd: 0,
  monthlyAiCostActualUsd: 200,
  monthlySandboxCostActualUsd: 50,
  remainingUsd: 750,
};

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

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
      <CostDashboard />
    </QueryClientProvider>,
  );
}

describe('CostDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CostDashboard />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading cost data...')).toBeInTheDocument();
  });

  it('should render cost cards after loading', async () => {
    renderWithQuery(mockCostData);
    expect(await screen.findByText('$1000.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$750.00')).toBeInTheDocument();
  });

  it('should render card labels', async () => {
    renderWithQuery(mockCostData);
    expect(await screen.findByText('Budget Limit')).toBeInTheDocument();
    expect(screen.getByText('Total Used')).toBeInTheDocument();
    expect(screen.getByText('AI Cost')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
  });

  it('should render chart containers', async () => {
    renderWithQuery(mockCostData);
    await screen.findByText('Budget Limit');
    expect(screen.getByText('Cost Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Budget Overview')).toBeInTheDocument();
  });
});
