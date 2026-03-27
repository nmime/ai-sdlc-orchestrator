import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ContentTypeGuard } from '../content-type.guard';

function mockContext(method: string, contentType?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        headers: contentType !== undefined ? { 'content-type': contentType } : {},
      }),
    }),
  } as any;
}

describe('ContentTypeGuard', () => {
  const guard = new ContentTypeGuard();

  it('should allow GET requests without content-type', () => {
    expect(guard.canActivate(mockContext('GET'))).toBe(true);
  });

  it('should allow HEAD requests without content-type', () => {
    expect(guard.canActivate(mockContext('HEAD'))).toBe(true);
  });

  it('should allow OPTIONS requests without content-type', () => {
    expect(guard.canActivate(mockContext('OPTIONS'))).toBe(true);
  });

  it('should allow POST with application/json', () => {
    expect(guard.canActivate(mockContext('POST', 'application/json'))).toBe(true);
  });

  it('should allow application/json with charset param', () => {
    expect(guard.canActivate(mockContext('POST', 'application/json; charset=utf-8'))).toBe(true);
  });

  it('should reject POST without content-type', () => {
    expect(() => guard.canActivate(mockContext('POST'))).toThrow(UnsupportedMediaTypeException);
    expect(() => guard.canActivate(mockContext('POST'))).toThrow('Content-Type header is required');
  });

  it('should reject text/html', () => {
    expect(() => guard.canActivate(mockContext('POST', 'text/html'))).toThrow(UnsupportedMediaTypeException);
    expect(() => guard.canActivate(mockContext('POST', 'text/html'))).toThrow('Unsupported Content-Type: text/html');
  });

  it('should reject multipart/form-data', () => {
    expect(() => guard.canActivate(mockContext('PUT', 'multipart/form-data'))).toThrow(UnsupportedMediaTypeException);
  });

  it('should reject application/xml', () => {
    expect(() => guard.canActivate(mockContext('PATCH', 'application/xml'))).toThrow(UnsupportedMediaTypeException);
  });
});
