describe('initTelemetry', () => {
  const originalEnv = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = originalEnv;
    } else {
      delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    }
  });

  it('should return undefined when OTEL_EXPORTER_OTLP_ENDPOINT is not set', async () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    vi.resetModules();
    const { initTelemetry } = await import('../telemetry');
    const result = initTelemetry('test-service');
    expect(result).toBeUndefined();
  });
});
