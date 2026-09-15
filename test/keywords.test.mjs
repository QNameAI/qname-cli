import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/qname-cli.mjs', ...args], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('keywords sends the documented API request and supports text output', async () => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    requests.push({
      method: request.method,
      url: request.url,
      apiKey: request.headers['x-api-key'],
      body: JSON.parse(raw),
    });
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        source: 'Google Ads',
        currency: 'USD',
        results: [
          {
            text: 'ai video generator',
            avgMonthlySearches: 246000,
            competition: 'MEDIUM',
            lowTopOfPageBid: 1.43,
            highTopOfPageBid: 5.91,
            monthlySearchVolumes: [],
          },
        ],
        nextPageToken: null,
        totalSize: 1,
      })
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const env = {
      QNAME_API_KEY: 'qname_test',
      QNAME_BASE_URL: `http://127.0.0.1:${address.port}`,
    };
    const jsonRun = await runCli(
      [
        'keywords',
        'AI video generator',
        '--country',
        '2826',
        '--language',
        '1001',
        '--network',
        'partners',
        '--page-size',
        '25',
      ],
      env
    );
    assert.equal(jsonRun.code, 0, jsonRun.stderr);
    assert.equal(JSON.parse(jsonRun.stdout).command, 'keywords');
    assert.deepEqual(requests[0], {
      method: 'POST',
      url: '/api/keywords/research',
      apiKey: 'qname_test',
      body: {
        mode: 'keywords',
        keywords: ['AI video generator'],
        country: '2826',
        language: '1001',
        network: 'GOOGLE_SEARCH_AND_PARTNERS',
        pageSize: 25,
      },
    });

    const textRun = await runCli(
      ['keywords', '--website', 'canva.com', '--format', 'text'],
      env
    );
    assert.equal(textRun.code, 0, textRun.stderr);
    assert.match(textRun.stdout, /keyword\tavg_monthly_searches/);
    assert.match(textRun.stdout, /ai video generator\t246000\tMEDIUM/);
    assert.deepEqual(requests[1].body, {
      mode: 'website',
      keywords: [],
      website: 'canva.com',
      country: '2840',
      language: '1000',
      network: 'GOOGLE_SEARCH',
      pageSize: 100,
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('keywords rejects mixed keyword and website modes before calling API', async () => {
  const run = await runCli(['keywords', 'seed', '--website', 'example.com'], {
    QNAME_API_KEY: 'qname_test',
  });
  assert.equal(run.code, 1);
  assert.equal(JSON.parse(run.stderr).error.code, 'INVALID_KEYWORD_QUERY');
});
