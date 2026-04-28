import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3003';
const DEFAULT_TIMEOUT_MS = 15_000;

const securityHeaderChecks = [
  {
    label: 'X-Content-Type-Options',
    names: ['x-content-type-options'],
    validate: (value) => /^nosniff$/i.test(value),
    expected: 'nosniff',
  },
  {
    label: 'X-Frame-Options',
    names: ['x-frame-options'],
    validate: (value) => /^(deny|sameorigin)$/i.test(value),
    expected: 'DENY or SAMEORIGIN',
  },
  {
    label: 'Referrer-Policy',
    names: ['referrer-policy'],
    validate: Boolean,
    expected: 'present',
  },
  {
    label: 'Permissions-Policy',
    names: ['permissions-policy'],
    validate: Boolean,
    expected: 'present',
  },
  {
    label: 'Content-Security-Policy',
    names: ['content-security-policy', 'content-security-policy-report-only'],
    validate: Boolean,
    expected: 'present, enforcing or report-only',
  },
];

const results = [];

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SKIAPI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: Number(process.env.SKIAPI_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--base-url') {
      options.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    if (!arg.startsWith('-')) {
      options.baseUrl = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.baseUrl) throw new Error('Missing base URL');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/smoke-skiapi.mjs [base-url]

Defaults:
  base-url: ${DEFAULT_BASE_URL}

Options:
  --base-url <url>      Override target URL
  --timeout-ms <ms>     Per-request timeout, default ${DEFAULT_TIMEOUT_MS}

Environment:
  SKIAPI_SMOKE_BASE_URL
  SKIAPI_SMOKE_TIMEOUT_MS`);
}

function record(ok, name, detail) {
  results.push({ ok, name, detail });
}

function pass(name, detail) {
  record(true, name, detail);
}

function fail(name, detail) {
  record(false, name, detail);
}

function assertCheck(condition, name, passDetail, failDetail = passDetail) {
  if (condition) {
    pass(name, passDetail);
  } else {
    fail(name, failDetail);
  }
}

function targetUrl(baseUrl, path) {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function request(baseUrl, path, timeoutMs, options = {}) {
  const url = targetUrl(baseUrl, path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'skiapi-smoke/1.0',
        ...(options.headers || {}),
      },
      body: options.body,
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      url,
      response,
      headers: response.headers,
      body,
      contentType: response.headers.get('content-type') || '',
      status: response.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

function sha256Short(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function isSpaShell(httpResult) {
  return (
    httpResult.status === 200 &&
    /\btext\/html\b/i.test(httpResult.contentType) &&
    /<div\s+id=["']root["']/i.test(httpResult.body) &&
    /<script\b/i.test(httpResult.body)
  );
}

function readJson(httpResult) {
  try {
    return JSON.parse(httpResult.body);
  } catch (error) {
    fail('api/status json', `invalid JSON: ${error.message}`);
    return null;
  }
}

function getHeader(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return { name, value };
  }
  return null;
}

function checkSecurityHeaders(label, headers) {
  const missing = [];
  const invalid = [];

  for (const check of securityHeaderChecks) {
    const header = getHeader(headers, check.names);
    if (!header) {
      missing.push(check.label);
      continue;
    }
    if (!check.validate(header.value)) {
      invalid.push(`${check.label}=${JSON.stringify(header.value)} expected ${check.expected}`);
    }
  }

  assertCheck(
    missing.length === 0 && invalid.length === 0,
    `security headers: ${label}`,
    securityHeaderChecks.map((check) => check.label).join(', '),
    [...missing.map((name) => `missing ${name}`), ...invalid].join('; ')
  );
}

function checkCacheControl(headers, expectedPattern, name) {
  const value = headers.get('cache-control') || '';
  assertCheck(
    expectedPattern.test(value),
    name,
    value || '(empty)',
    `Cache-Control=${JSON.stringify(value)}, expected ${expectedPattern}`
  );
}

function printResults(baseUrl) {
  console.log(`SKIAPI smoke target: ${baseUrl}`);
  for (const result of results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    console.log(`${marker} ${result.name}: ${result.detail}`);
  }

  const failed = results.filter((result) => !result.ok).length;
  const passed = results.length - failed;
  console.log(failed ? `Smoke failed: ${failed} failed, ${passed} passed` : `Smoke passed: ${passed} checks`);

  if (failed) process.exitCode = 1;
}

async function main() {
  const { baseUrl, timeoutMs } = parseArgs(process.argv.slice(2));
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, '');

  const home = await request(normalizedBaseUrl, '/', timeoutMs);
  assertCheck(
    isSpaShell(home),
    'home page',
    `${home.status} ${home.contentType}; shell sha256=${sha256Short(home.body)}`,
    `${home.url} returned ${home.status} ${home.contentType || '(no content-type)'}`
  );
  checkSecurityHeaders('home page', home.headers);
  checkCacheControl(home.headers, /\bno-store\b/i, 'home cache policy');

  const manifest = await request(normalizedBaseUrl, '/site.webmanifest', timeoutMs);
  assertCheck(
    manifest.status === 200 && /\bapplication\/manifest\+json\b/i.test(manifest.contentType),
    'manifest mime',
    `${manifest.status} ${manifest.contentType}`,
    `${manifest.url} returned ${manifest.status} ${manifest.contentType || '(no content-type)'}`
  );

  const status = await request(normalizedBaseUrl, '/api/status', timeoutMs);
  assertCheck(
    status.status === 200 && /\bapplication\/json\b/i.test(status.contentType),
    'api/status http',
    `${status.status} ${status.contentType}`,
    `${status.url} returned ${status.status} ${status.contentType || '(no content-type)'}`
  );
  checkSecurityHeaders('api/status', status.headers);

  const statusJson = readJson(status);
  const statusData = statusJson?.data;
  assertCheck(
    statusJson?.success === true && statusData && typeof statusData === 'object',
    'api/status contract',
    'success=true with data object',
    `unexpected body shape: ${status.body.slice(0, 240)}`
  );

  const headerVersion = status.headers.get('x-new-api-version') || '';
  const bodyVersion = typeof statusData?.version === 'string' ? statusData.version : '';
  const version = bodyVersion || headerVersion;
  assertCheck(
    Boolean(version),
    'backend version',
    version ? `${version}${headerVersion && bodyVersion ? ` (header ${headerVersion})` : ''}` : '',
    'missing data.version and X-New-Api-Version'
  );
  if (headerVersion && bodyVersion) {
    assertCheck(
      headerVersion === bodyVersion,
      'backend version consistency',
      `header and body both ${bodyVersion}`,
      `header=${headerVersion}, body=${bodyVersion}`
    );
  }

  assertCheck(
    statusData?.setup === true,
    'setup status',
    'setup=true',
    `setup=${JSON.stringify(statusData?.setup)}`
  );

  const fallbackPath = `/__smoke_spa_fallback_${randomUUID().replaceAll('-', '')}`;
  const fallback = await request(normalizedBaseUrl, fallbackPath, timeoutMs);
  const fallbackHash = sha256Short(fallback.body);
  const homeHash = sha256Short(home.body);
  assertCheck(
    isSpaShell(fallback) && fallback.body === home.body,
    'spa fallback',
    `${fallback.status} ${fallback.contentType}; ${fallbackPath}; shell sha256=${fallbackHash}`,
    `${fallback.url} returned ${fallback.status} ${fallback.contentType || '(no content-type)'}; fallback sha256=${fallbackHash}; home sha256=${homeHash}`
  );

  const missingStaticPath = `/__smoke_missing_${randomUUID().replaceAll('-', '')}.js`;
  const missingStatic = await request(normalizedBaseUrl, missingStaticPath, timeoutMs);
  assertCheck(
    missingStatic.status === 404 && !isSpaShell(missingStatic),
    'missing static asset',
    `${missingStatic.status} ${missingStatic.contentType || '(no content-type)'}`,
    `${missingStatic.url} returned ${missingStatic.status} ${missingStatic.contentType || '(no content-type)'}`
  );

  const setupPost = await request(normalizedBaseUrl, '/api/setup', timeoutMs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assertCheck(
    setupPost.status === 403 || setupPost.status === 405,
    'setup post blocked at edge',
    `${setupPost.status} ${setupPost.contentType || '(no content-type)'}`,
    `${setupPost.url} returned ${setupPost.status}; body=${setupPost.body.slice(0, 160)}`
  );

  printResults(normalizedBaseUrl);
}

main().catch((error) => {
  fail('smoke runner', error?.message || String(error));
  printResults(process.env.SKIAPI_SMOKE_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL);
  process.exitCode = 1;
});
