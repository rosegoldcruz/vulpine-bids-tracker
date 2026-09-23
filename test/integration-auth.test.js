const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateIntegrationRequest, constantTimeEqual, isTrustedLegacyUi, normalizeCorrelationId } = require('../integration-auth');

test('constant-time digest comparison accepts only the exact token', () => {
  assert.equal(constantTimeEqual('expected-token', 'expected-token'), true);
  assert.equal(constantTimeEqual('wrong-token', 'expected-token'), false);
  assert.equal(constantTimeEqual('short', 'a-much-longer-token'), false);
  assert.equal(constantTimeEqual('', 'expected-token'), false);
});

test('external integration requests fail closed', () => {
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: '', providedToken: '' }),
    { allowed: false, status: 503, code: 'INTEGRATION_NOT_CONFIGURED', message: 'Integration authentication is not configured.' },
  );
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: 'expected-token', providedToken: 'wrong-token' }),
    { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Invalid integration credentials.' },
  );
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: 'expected-token', providedToken: 'expected-token' }),
    { allowed: true, actor: 'backoffice-service' },
  );
});

test('direct loopback maintenance remains available', () => {
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: '', providedToken: '', directLoopback: true }),
    { allowed: true, actor: 'server-local' },
  );
});

test('the supported standalone tracker UI is allowed without weakening other external callers', () => {
  assert.equal(isTrustedLegacyUi({ hostname: 'tracker.vulpine.llc' }, 'tracker.vulpine.llc'), true);
  assert.equal(isTrustedLegacyUi({ hostname: 'api.vulpinehomes.com' }, 'tracker.vulpine.llc'), false);
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: 'expected-token', providedToken: '', trustedLegacyUi: true }),
    { allowed: true, actor: 'legacy-tracker-ui' },
  );
  assert.deepEqual(
    authenticateIntegrationRequest({ configuredToken: 'expected-token', providedToken: '', trustedLegacyUi: false }),
    { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Invalid integration credentials.' },
  );
});

test('correlation IDs are preserved only when safe', () => {
  assert.equal(normalizeCorrelationId('corr-test-1234'), 'corr-test-1234');
  assert.match(normalizeCorrelationId('bad id'), /^[0-9a-f-]{36}$/);
});
