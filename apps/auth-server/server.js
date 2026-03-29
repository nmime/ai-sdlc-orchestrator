import Fastify from 'fastify';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3001';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';
const PORT = parseInt(process.env.AUTH_PORT || '3001', 10);
const JWT_ISSUER = process.env.JWT_ISSUER || AUTH_SERVER_URL;
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const KEY_PATH = resolve(__dirname, '.keys.json');
let rsaPrivateKey;
let rsaPublicJwk;
let keyId;

async function loadOrGenerateKeys() {
  if (existsSync(KEY_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
      const { importJWK } = await import('jose');
      rsaPrivateKey = await importJWK(stored.privateKey, 'RS256');
      rsaPublicJwk = stored.publicKey;
      keyId = stored.kid;
      console.log(`Loaded existing RSA key pair (kid: ${keyId})`);
      return;
    } catch (e) {
      console.warn('Failed to load stored keys, generating new ones:', e.message);
    }
  }

  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
  rsaPrivateKey = privateKey;
  keyId = randomBytes(8).toString('hex');
  const privJwk = await exportJWK(privateKey);
  const pubJwk = await exportJWK(publicKey);
  pubJwk.kid = keyId;
  pubJwk.alg = 'RS256';
  pubJwk.use = 'sig';
  rsaPublicJwk = pubJwk;

  writeFileSync(KEY_PATH, JSON.stringify({ privateKey: privJwk, publicKey: pubJwk, kid: keyId }, null, 2));
  console.log(`Generated new RSA key pair (kid: ${keyId})`);
}

const pendingStates = new Map();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > 10 * 60 * 1000) pendingStates.delete(key);
  }
}

const app = Fastify({ logger: true });

app.get('/auth/health', async () => ({ status: 'ok', google: !!GOOGLE_CLIENT_ID }));

app.get('/auth/.well-known/openid-configuration', async () => ({
  issuer: JWT_ISSUER,
  authorization_endpoint: `${AUTH_SERVER_URL}/auth/google`,
  token_endpoint: `${AUTH_SERVER_URL}/auth/token`,
  jwks_uri: `${AUTH_SERVER_URL}/auth/.well-known/jwks.json`,
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
}));

app.get('/auth/.well-known/jwks.json', async () => ({
  keys: [rsaPublicJwk],
}));

app.get('/auth/google', async (request, reply) => {
  if (!GOOGLE_CLIENT_ID) {
    return reply.status(500).send({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }

  cleanExpiredStates();

  const state = randomBytes(32).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  pendingStates.set(state, { codeVerifier, createdAt: Date.now() });

  const redirectUri = `${AUTH_SERVER_URL}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/google/callback', async (request, reply) => {
  const { code, state, error } = request.query;

  if (error) {
    return reply.redirect(`${DASHBOARD_URL}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return reply.redirect(`${DASHBOARD_URL}/login?error=missing_params`);
  }

  const pending = pendingStates.get(state);
  if (!pending) {
    return reply.redirect(`${DASHBOARD_URL}/login?error=invalid_state`);
  }
  pendingStates.delete(state);

  try {
    const redirectUri = `${AUTH_SERVER_URL}/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pending.codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Google token exchange failed:', errBody);
      return reply.redirect(`${DASHBOARD_URL}/login?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userinfoRes.ok) {
      return reply.redirect(`${DASHBOARD_URL}/login?error=userinfo_failed`);
    }

    const userinfo = await userinfoRes.json();

    const jwt = await new SignJWT({
      sub: userinfo.sub,
      email: userinfo.email,
      name: userinfo.name,
      picture: userinfo.picture,
      email_verified: userinfo.email_verified,
      role: 'admin',
      tenant_id: DEFAULT_TENANT_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(JWT_ISSUER)
      .setAudience(GOOGLE_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(rsaPrivateKey);

    const params = new URLSearchParams({
      token: jwt,
      email: userinfo.email,
      name: userinfo.name || '',
      picture: userinfo.picture || '',
      tenant_id: DEFAULT_TENANT_ID,
    });

    return reply.redirect(`${DASHBOARD_URL}/auth/callback?${params}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return reply.redirect(`${DASHBOARD_URL}/login?error=internal_error`);
  }
});

app.get('/auth/me', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const { jwtVerify, createLocalJWKSet } = await import('jose');
    const jwks = createLocalJWKSet({ keys: [rsaPublicJwk] });
    const { payload } = await jwtVerify(authHeader.slice(7), jwks, {
      issuer: JWT_ISSUER,
    });
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      role: payload.role,
      tenantId: payload.tenant_id,
      emailVerified: payload.email_verified,
    };
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid token', details: err.message });
  }
});

app.post('/auth/refresh', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const { jwtVerify, createLocalJWKSet } = await import('jose');
    const jwks = createLocalJWKSet({ keys: [rsaPublicJwk] });
    const { payload } = await jwtVerify(authHeader.slice(7), jwks, {
      issuer: JWT_ISSUER,
      clockTolerance: 60 * 60,
    });

    const jwt = await new SignJWT({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
      role: payload.role,
      tenant_id: payload.tenant_id,
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(JWT_ISSUER)
      .setAudience(GOOGLE_CLIENT_ID || 'opwerf')
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(rsaPrivateKey);

    return { token: jwt };
  } catch (err) {
    return reply.status(401).send({ error: 'Token refresh failed', details: err.message });
  }
});

app.post('/auth/logout', async () => ({ success: true }));

await loadOrGenerateKeys();

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`Auth server running on port ${PORT}`);
console.log(`JWKS endpoint: ${AUTH_SERVER_URL}/auth/.well-known/jwks.json`);
console.log(`Google OAuth: ${GOOGLE_CLIENT_ID ? 'configured' : 'NOT configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'}`); 
