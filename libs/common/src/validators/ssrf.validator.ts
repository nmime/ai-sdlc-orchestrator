import { BadRequestException } from '@nestjs/common';
import { URL } from 'node:url';
import { isIP } from 'node:net';

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
  /^::1$/,
  /^::$/,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

export function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Only HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname === '[::1]') {
    throw new BadRequestException('Localhost URLs are not allowed');
  }

  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new BadRequestException('Private IP addresses are not allowed');
  }

  if (parsed.port && !['443', ''].includes(parsed.port)) {
    throw new BadRequestException('Non-standard ports are not allowed for HTTPS');
  }

  return parsed;
}
