# @qname/cli

Agent-native CLI for QName.AI WHOIS and traffic lookup APIs.

The CLI is the recommended client for QName API keys. It intentionally exposes
only the approved WHOIS scopes: `domain.query.whois.single` and
`domain.query.whois.batch`, plus the traffic scope `domain.traffic.lookup`.
Those scopes cover WHOIS/domain lookup through `GET /api/whois/{domain}` or
`POST /api/whois/batch`, and traffic lookup through
`GET /api/domain-traffic?domain=example.com`. Calls are capped by the API types,
per-request domain quota, and daily request quota approved for your key.
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
```

For local development inside this repository:

```bash
node bin/qname-cli.mjs --help
```

## Request API Access

1. Open `https://qname.ai/settings/apikeys`.
2. Submit an API key request for `qname-cli`, choose the single-domain WHOIS,
   batch WHOIS, and traffic lookup API types you need, and choose the domain
   and daily request quota tiers.
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
qname-cli config get --pretty
qname-cli config set --api-key qname_xxx
qname-cli doctor
qname-cli request-key
qname-cli skill --path
```

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
They must stay within the approved API types, per-request domain quota, and
daily request quota for the configured key.
