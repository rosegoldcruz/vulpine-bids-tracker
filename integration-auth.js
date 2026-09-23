const { createHash, randomUUID, timingSafeEqual } = require('crypto');

const INTEGRATION_HEADER = 'x-vulpine-integration-key';
const CORRELATION_HEADER = 'x-correlation-id';
const ACTOR_HEADER = 'x-vulpine-actor';

function normalizeCorrelationId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(candidate) ? candidate : randomUUID();
}

function constantTimeEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function isDirectLoopback(req) {
  if (req.headers['x-forwarded-for']) return false;
  const address = req.socket?.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isTrustedLegacyUi(req, legacyUiHost) {
  return Boolean(legacyUiHost) && req.hostname === legacyUiHost;
}

function authenticateIntegrationRequest({ configuredToken, providedToken, directLoopback = false, trustedLegacyUi = false }) {
  if (directLoopback) return { allowed: true, actor: 'server-local' };
  if (trustedLegacyUi) return { allowed: true, actor: 'legacy-tracker-ui' };
  if (!configuredToken) {
    return { allowed: false, status: 503, code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integration authentication is not configured.' };
  }
  if (!constantTimeEqual(providedToken, configuredToken)) {
    return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Invalid integration credentials.' };
  }
  return { allowed: true, actor: 'backoffice-service' };
}

function createIntegrationAuth({ legacyUiHost = 'tracker.vulpine.llc' } = {}) {
  return (req, res, next) => {
    const correlationId = normalizeCorrelationId(req.get(CORRELATION_HEADER));
    const startedAt = Date.now();
    res.set(CORRELATION_HEADER, correlationId);
    res.on('finish', () => {
      const requestedActor = req.get(ACTOR_HEADER);
      const actor = requestedActor && /^[a-zA-Z0-9@._:-]{1,160}$/.test(requestedActor) ? requestedActor : (res.locals.integrationActor || 'unknown');
      console.info(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'bids-tracker',
        method: req.method,
        route: req.path,
        status: res.statusCode,
        correlationId,
        actor,
        durationMs: Date.now() - startedAt,
      }));
    });

    const auth = authenticateIntegrationRequest({
      configuredToken: (process.env.BIDS_TRACKER_API_TOKEN || '').trim(),
      providedToken: req.get(INTEGRATION_HEADER) || '',
      directLoopback: isDirectLoopback(req),
      trustedLegacyUi: isTrustedLegacyUi(req, legacyUiHost),
    });
    if (!auth.allowed) {
      return res.status(auth.status).json({ error: auth.message, code: auth.code, correlation_id: correlationId });
    }
    res.locals.integrationActor = auth.actor;
    return next();
  };
}

module.exports = {
  INTEGRATION_HEADER,
  authenticateIntegrationRequest,
  constantTimeEqual,
  createIntegrationAuth,
  isTrustedLegacyUi,
  normalizeCorrelationId,
};
