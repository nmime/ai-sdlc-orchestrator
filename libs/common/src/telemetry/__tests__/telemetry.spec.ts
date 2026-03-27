const mockStart = vi.fn();

vi.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: class MockNodeSDK {
      start = mockStart;
      constructor() {}
    },
  };
});
vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {},
}));
vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn().mockReturnValue({}),
}));
vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));
vi.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: class {},
}));

import { initTelemetry } from '../telemetry';

describe('initTelemetry', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('should return undefined when OTEL_EXPORTER_OTLP_ENDPOINT is not set', () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    const sdk = initTelemetry('test-service');
    expect(sdk).toBeUndefined();
  });

  it('should create and start SDK when OTEL endpoint is configured', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4318';
    const sdk = initTelemetry('test-service');
    expect(sdk).toBeDefined();
    expect(mockStart).toHaveBeenCalled();
  });

  it('should use APP_VERSION env var when available', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4318';
    process.env['APP_VERSION'] = '1.2.3';
    const sdk = initTelemetry('my-service');
    expect(sdk).toBeDefined();
  });

  it('should use default version when APP_VERSION not set', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4318';
    delete process.env['APP_VERSION'];
    const sdk = initTelemetry('my-service');
    expect(sdk).toBeDefined();
  });
});
