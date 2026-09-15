# @qname/cli

Agent-native CLI for QName AI WHOIS, traffic, and Google keyword research APIs.

The CLI is the recommended client for QName AI API keys. It exposes the approved
WHOIS scopes `domain.query.whois.single` and `domain.query.whois.batch`, the
traffic scope `domain.traffic.lookup`, and Google Ads keyword research through
`keyword.research`. Calls are capped by the API types, per-request domain quota,
and daily request quota approved for your key.
Realtime streams, registrar purchase actions, and domain rating data are
outside the CLI command surface.

## Install

```bash
npm install -g @qname/cli
```

Install the Agent Skill:

```bash
npx skills add QNameAI/qname-cli -y -g
```

Configure credentials once:

```bash
qname-cli init --api-key <approved-key>
```

Run a lookup:

```bash
qname-cli whois qname.ai --pretty
qname-cli whois qname.ai example.com --pretty
qname-cli traffic qname.ai --pretty
qname-cli keywords "ai video generator" --pretty
qname-cli keywords --website canva.com --pretty
```

For local development inside this repository:

```bash
node bin/qname-cli.mjs --help
```

## Request API Access

1. Open `https://qname.ai/settings/apikeys`.
2. Submit an API key request for `qname-cli`, choose the single-domain WHOIS,
   batch WHOIS, traffic lookup, and keyword research API types you need, then
   choose the domain and daily request quota tiers.
3. Wait for admin approval.
4. Reveal the approved key once and initialize the CLI.

```bash
qname-cli init --api-key qname_xxx
```

You can also use environment variables in CI or Agent runs:

```bash
export QNAME_API_KEY="qname_xxx"
export QNAME_BASE_URL="https://qname.ai"
```

## Commands

```bash
qname-cli whois qname.ai --pretty
qname-cli whois qname.ai example.com --pretty
qname-cli whois qname.ai --format text
qname-cli traffic qname.ai --pretty
qname-cli traffic qname.ai --format text
qname-cli keywords "ai video generator" --country 2840 --language 1000 --pretty
qname-cli keywords "ai video generator" "text to video" --format text
qname-cli keywords --website canva.com --network partners --pretty
qname-cli config get --pretty
qname-cli config set --api-key qname_xxx
qname-cli doctor
qname-cli request-key
qname-cli skill --path
```

Keyword research uses `POST /api/keywords/research` and requires the
`keyword.research` scope. Options:

- `--country <id>`: Google Ads geographic target ID; defaults to `2840` (US).
- `--language <id>`: Google Ads language target ID; defaults to `1000` (English).
- `--network google|partners`: Google Search or Search with partners.
- `--page-size <1-100>` and `--page-token <token>`: result pagination.
- `--format text`: tab-separated summary; JSON is the default.

`qname-cli` defaults to JSON output so humans and AI Agents can parse results
without screen scraping.

## Agent Usage

Install the Agent Skill globally:

```bash
npx skills add QNameAI/qname-cli -y -g
```

Agent instructions are also bundled inside the npm package at:

```bash
qname-cli skill --path
```

Agents should prefer `qname-cli whois <domain...> --pretty` for domain
availability evidence and `qname-cli traffic <domain> --pretty` for traffic
analytics over direct `curl` unless they are debugging the API contract itself.
Use `qname-cli keywords "<seed>" --pretty` for Google Ads keyword ideas, monthly
search volumes, competition, bid ranges, and 12-month history. Use
`qname-cli keywords --website <domain>` to discover ideas from a public site.
They must stay within the approved API types, per-request domain quota, and
daily request quota for the configured key.
