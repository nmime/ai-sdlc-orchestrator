import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Controller, Post, Body, Module, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ContentTypeGuard } from '@ai-sdlc/common';
import { ConfigService } from '@nestjs/config';

@Controller('guarded')
@UseGuards(ContentTypeGuard)
class GuardedController {
  @Post('echo')
  @HttpCode(HttpStatus.OK)
  echo(@Body() body: Record<string, unknown>) {
    return body;
  }
}

@Module({
  controllers: [GuardedController],
})
class GuardedModule {}

describe('ContentTypeGuard Integration', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GuardedModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should accept POST with application/json', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/guarded/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ key: 'value' }),
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ key: 'value' });
  });

  it('should reject POST with text/plain', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/guarded/echo',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
  });

  it('should reject POST without content-type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/guarded/echo',
      payload: '',
    });
    expect(response.statusCode).toBe(415);
  });
});
