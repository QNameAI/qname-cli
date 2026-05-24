# @qname/cli

Agent-native CLI for QName.AI domain lookup APIs.

The CLI is the recommended client for QName API keys. It intentionally exposes
only the approved `domain.query.whois` scope: WHOIS/domain lookup through
`GET /api/whois/{domain}` or `POST /api/whois/batch`, capped by the
per-request domain quota and daily request quota approved for your key.
Realtime streams, domain traffic, and domain analysis data are outside this
CLI/API scope.

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
```

For local development inside this repository:

```bash
node bin/qname-cli.mjs --help
```

## Request API Access

1. Open `https://qname.ai/settings/apikeys`.
2. Submit an API key request for `qname-cli` and choose the domain and daily
   request quota tiers.
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

Agents should prefer `qname-cli whois <domain...> --pretty` over direct `curl`
unless they are debugging the API contract itself, and must stay within the
approved per-request domain quota and daily request quota for the configured
key.
