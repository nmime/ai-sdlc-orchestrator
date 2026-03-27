import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { AllExceptionsFilter, ContentTypeGuard } from '@ai-sdlc/common';
import { ConfigService } from '@nestjs/config';

@Controller('test')
class TestController {
  @Get('ok')
  ok() {
    return { status: 'ok' };
  }

  @Get('error')
  error() {
    throw new Error('boom');
  }
}

@Module({
  controllers: [TestController],
})
class TestModule {}

describe('API Integration', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionsFilter(new ConfigService()));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return JSON on success', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/ok',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });

  it('should return 500 with structured error body on unhandled exception', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/error',
    });
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.path).toBe('/test/error');
    expect(body.timestamp).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent',
    });
    expect(response.statusCode).toBe(404);
  });
});
