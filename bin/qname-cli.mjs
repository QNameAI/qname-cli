#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'https://qname.ai';
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.qname', 'config.json');

const COMMANDS = new Set([
  'init',
  'whois',
  'config',
  'doctor',
  'request-key',
  'docs',
  'skill',
  'help',
  'version',
]);

class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.code = options.code ?? 'CLI_ERROR';
    this.status = options.status ?? null;
    this.details = options.details ?? null;
  }
}

function parseArgv(argv) {
  const args = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--') {
      args.push(...argv.slice(index + 1));
      break;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const [key, inlineValue] = body.split(/=(.*)/s).filter(Boolean);
      const next = argv[index + 1];
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
      } else if (next && !next.startsWith('--')) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }

    args.push(token);
  }

  const command = args[0] && COMMANDS.has(args[0]) ? args.shift() : 'help';
  return { command, args, flags };
}

function getConfigPath(flags = {}) {
  return String(
    flags.config || process.env.QNAME_CLI_CONFIG || DEFAULT_CONFIG_PATH
  );
}

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim();
  const parsed = new URL(raw);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function redactSecret(value) {
  if (!value) return null;
  const raw = String(value);
  if (raw.length <= 10) return '***';
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function formatJson(value, flags = {}) {
  return JSON.stringify(value, null, flags.pretty ? 2 : 0);
}

function print(value, flags = {}) {
  if (typeof value === 'string') {
    console.log(value);
    return;
  }

  console.log(formatJson(value, flags));
}

async function readPackageJson() {
  const packageUrl = new URL('../package.json', import.meta.url);
  return JSON.parse(await readFile(packageUrl, 'utf8'));
}

async function readConfig(flags = {}) {
  const configPath = getConfigPath(flags);

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new CliError(`Could not read config at ${configPath}`, {
      code: 'CONFIG_READ_FAILED',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function writeConfig(config, flags = {}) {
  const configPath = getConfigPath(flags);
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`,
    {
      mode: 0o600,
    }
  );
  await fs.promises.chmod(configPath, 0o600).catch(() => {});
  return configPath;
}

async function promptSecret(label) {
  if (!process.stdin.isTTY) {
    throw new CliError(`${label} is required in non-interactive mode.`, {
      code: 'MISSING_REQUIRED_VALUE',
    });
  }

  const rl = createInterface({ input, output });
  try {
    const value = await rl.question(`${label}: `);
    return value.trim();
  } finally {
    rl.close();
  }
}

async function resolveRuntimeConfig(flags = {}) {
  const stored = await readConfig(flags);
  const baseUrl = normalizeBaseUrl(
    flags['base-url'] || process.env.QNAME_BASE_URL || stored.baseUrl
  );
  const apiKey = String(
    flags['api-key'] || process.env.QNAME_API_KEY || stored.apiKey || ''
  ).trim();

  return {
    baseUrl,
    apiKey,
    configPath: getConfigPath(flags),
  };
}

function ensureApiKey(apiKey) {
  if (!apiKey) {
    throw new CliError(
      'Missing API key. Run `qname-cli init --api-key <key>` or set QNAME_API_KEY.',
      { code: 'MISSING_API_KEY' }
    );
  }
}

function normalizeDomainToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0];
}

function domainsFromArgs(args, flags) {
  const raw = [];
  if (flags.domain) raw.push(flags.domain);
  if (flags.domains) raw.push(flags.domains);
  raw.push(...args);

  const domains = [];
  const invalid = [];

  for (const token of raw) {
    for (const part of String(token).split(/[\s,]+/)) {
      const domain = normalizeDomainToken(part);
      if (!domain) continue;

      if (!domain.includes('.')) {
        invalid.push(part);
        continue;
      }

      if (!domains.includes(domain)) domains.push(domain);
    }
  }

  if (invalid.length) {
    throw new CliError(`Invalid domain: ${invalid[0]}`, {
      code: 'INVALID_DOMAIN',
    });
  }

  if (!domains.length) {
    throw new CliError('Enter a valid domain, for example `qname.ai`.', {
      code: 'INVALID_DOMAIN',
    });
  }

  return domains;
}

async function readJsonFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

async function commandInit(_args, flags) {
  const inputConfig = flags.stdin ? await readJsonFromStdin() : {};
  const current = await readConfig(flags);
  const baseUrl = normalizeBaseUrl(
    flags['base-url'] || inputConfig.baseUrl || current.baseUrl
  );
  const apiKey =
    String(flags['api-key'] || inputConfig.apiKey || '').trim() ||
    (await promptSecret('QName API key'));

  if (!apiKey) {
    throw new CliError('API key is required.', {
      code: 'MISSING_API_KEY',
    });
  }

  const configPath = await writeConfig(
    {
      ...current,
      baseUrl,
      apiKey,
    },
    flags
  );

  print(
    {
      ok: true,
      command: 'init',
      configPath,
      baseUrl,
      apiKey: redactSecret(apiKey),
    },
    flags
  );
}

async function commandWhois(args, flags) {
  const domains = domainsFromArgs(args, flags);
  const { baseUrl, apiKey } = await resolveRuntimeConfig(flags);
  ensureApiKey(apiKey);
  const isBatch = domains.length > 1;
  const body = isBatch
    ? await fetchWhoisBatch({ baseUrl, apiKey, domains })
    : await fetchWhois({ baseUrl, apiKey, domain: domains[0] });

  if (flags.format === 'text') {
    const lines = isBatch
      ? (body?.results ?? []).map(
          (item) => `${item.domain}: ${statusFromBatchItem(item)}`
        )
      : [`${domains[0]}: ${statusFromWhoisResponse(body)}`];
    print(lines.join('\n'), flags);
    return;
  }

  print(
    {
      ok: true,
      command: 'whois',
      ...(isBatch ? { domains } : { domain: domains[0] }),
      endpoint: isBatch ? '/api/whois/batch' : '/api/whois/{domain}',
      data: body,
    },
    flags
  );
}

function statusFromWhoisResponse(body) {
  if (body?.result && body?.data) return 'registered';
  if (body?.code === 'DOMAIN_NOT_REGISTERED') return 'available';
  if (body?.code === 'DOMAIN_RESERVED') return 'reserved';
  return body?.code || 'unknown';
}

function statusFromBatchItem(item) {
  if (item?.code === 'SUCCESS' && item?.result) return 'registered';
  if (item?.code === 'DOMAIN_NOT_REGISTERED') return 'available';
  if (item?.code === 'DOMAIN_RESERVED') return 'reserved';
  return item?.code || 'unknown';
}

async function fetchWhois({ baseUrl, apiKey, domain }) {
  const url = new URL(`/api/whois/${encodeURIComponent(domain)}`, baseUrl);
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': '@qname/cli',
      'x-api-key': apiKey,
    },
  });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;

  if (
    !response.ok &&
    !(response.status === 404 && body?.code === 'DOMAIN_NOT_REGISTERED')
  ) {
    throw new CliError(body?.error || `QName API returned ${response.status}`, {
      code: body?.code || 'API_ERROR',
      status: response.status,
      details: body,
    });
  }

  return body;
}

async function fetchWhoisBatch({ baseUrl, apiKey, domains }) {
  const url = new URL('/api/whois/batch', baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': '@qname/cli',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ domains }),
  });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new CliError(body?.error || `QName API returned ${response.status}`, {
      code: body?.code || 'API_ERROR',
      status: response.status,
      details: body,
    });
  }

  return body;
}

async function commandConfig(args, flags) {
  const subcommand = args[0] || 'get';

  if (subcommand === 'path') {
    print({ ok: true, configPath: getConfigPath(flags) }, flags);
    return;
  }

  if (subcommand === 'get') {
    const config = await readConfig(flags);
    print(
      {
        ok: true,
        configPath: getConfigPath(flags),
        baseUrl: config.baseUrl || null,
        apiKey: flags['show-secrets']
          ? config.apiKey || null
          : redactSecret(config.apiKey),
      },
      flags
    );
    return;
  }

  if (subcommand === 'set') {
    const current = await readConfig(flags);
    const next = { ...current };
    if (flags['base-url']) next.baseUrl = normalizeBaseUrl(flags['base-url']);
    if (flags['api-key']) next.apiKey = String(flags['api-key']).trim();
    const configPath = await writeConfig(next, flags);
    print(
      {
        ok: true,
        configPath,
        baseUrl: next.baseUrl || null,
        apiKey: redactSecret(next.apiKey),
      },
      flags
    );
    return;
  }

  throw new CliError('Unknown config subcommand. Use get, set, or path.', {
    code: 'UNKNOWN_COMMAND',
  });
}

async function commandDoctor(_args, flags) {
  const runtime = await resolveRuntimeConfig(flags);
  const checks = [
    {
      name: 'configPath',
      ok: Boolean(runtime.configPath),
      value: runtime.configPath,
    },
    { name: 'baseUrl', ok: Boolean(runtime.baseUrl), value: runtime.baseUrl },
    {
      name: 'apiKey',
      ok: Boolean(runtime.apiKey),
      value: redactSecret(runtime.apiKey),
    },
  ];

  if (flags['check-api']) {
    try {
      await fetchWhois({
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        domain: 'qname.ai',
      });
      checks.push({ name: 'api', ok: true, value: 'reachable' });
    } catch (error) {
      checks.push({
        name: 'api',
        ok: false,
        value: error instanceof Error ? error.message : String(error),
      });
    }
  }

  print(
    {
      ok: checks.every((check) => check.ok),
      command: 'doctor',
      checks,
    },
    flags
  );
}

async function commandRequestKey(_args, flags) {
  const baseUrl = normalizeBaseUrl(
    flags['base-url'] || process.env.QNAME_BASE_URL
  );
  const url = new URL('/settings/apikeys', baseUrl).toString();
  print(
    {
      ok: true,
      command: 'request-key',
      url,
      scope: 'domain.query.whois',
      note: 'Request approval and a per-request domain quota before using qname-cli with the QName API.',
    },
    flags
  );
}

async function commandDocs(_args, flags) {
  const baseUrl = normalizeBaseUrl(
    flags['base-url'] || process.env.QNAME_BASE_URL
  );
  const packageRoot = fileURLToPath(new URL('..', import.meta.url));
  print(
    {
      ok: true,
      command: 'docs',
      docs: {
        api: 'docs/api.md',
        cli: 'docs/qname-cli.md',
        packageReadme: path.join(packageRoot, 'README.md'),
        skill: path.join(packageRoot, 'skills/qname-cli/SKILL.md'),
        requestKey: `${baseUrl}/settings/apikeys`,
      },
      scope: 'domain.query.whois',
    },
    flags
  );
}

async function commandSkill(_args, flags) {
  const skillPath = fileURLToPath(
    new URL('../skills/qname-cli/SKILL.md', import.meta.url)
  );

  if (flags.path) {
    print({ ok: true, skillPath }, flags);
    return;
  }

  const content = await readFile(skillPath, 'utf8');
  print(content, flags);
}

async function commandHelp(flags) {
  const pkg = await readPackageJson();
  print(
    `qname-cli ${pkg.version}

Agent-native CLI for QName.AI domain lookup.

Usage:
  qname-cli init --api-key <key> [--base-url https://qname.ai]
  qname-cli whois qname.ai [example.com ...] [--pretty]
  qname-cli config get
  qname-cli config set --api-key <key>
  qname-cli doctor [--check-api]
  qname-cli request-key
  qname-cli skill [--path]

Environment:
  QNAME_API_KEY       API key issued from QName.AI settings
  QNAME_BASE_URL      API base URL, default https://qname.ai
  QNAME_CLI_CONFIG    Config path, default ~/.qname/config.json
`,
    flags
  );
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const { command, args, flags } = parsed;

  if (flags.help || command === 'help') {
    await commandHelp(flags);
    return;
  }

  if (command === 'version') {
    const pkg = await readPackageJson();
    print({ ok: true, version: pkg.version }, flags);
    return;
  }

  if (command === 'init') return commandInit(args, flags);
  if (command === 'whois') return commandWhois(args, flags);
  if (command === 'config') return commandConfig(args, flags);
  if (command === 'doctor') return commandDoctor(args, flags);
  if (command === 'request-key') return commandRequestKey(args, flags);
  if (command === 'docs') return commandDocs(args, flags);
  if (command === 'skill') return commandSkill(args, flags);

  throw new CliError(`Unknown command: ${command}`, {
    code: 'UNKNOWN_COMMAND',
  });
}

main().catch((error) => {
  const flags = parseArgv(process.argv.slice(2)).flags;
  const payload = {
    ok: false,
    error: {
      code: error?.code || 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : String(error),
      status: error?.status || undefined,
      details: error?.details || undefined,
    },
  };

  console.error(formatJson(payload, flags));
  process.exitCode = error?.status === 401 ? 3 : 1;
});
