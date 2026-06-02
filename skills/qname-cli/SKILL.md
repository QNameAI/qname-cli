---
name: qname-cli
description: Use QName.AI domain lookup from the terminal. Call this when an Agent needs WHOIS/domain availability or traffic evidence through the approved QName API, staying within the key's approved API types and quotas.
metadata:
  homepage: https://qname.ai
---

# QName CLI

Use `qname-cli` when you need WHOIS/domain availability or traffic evidence
from QName.AI in a terminal workflow.

## Scope

Allowed:

- WHOIS lookup with `qname-cli whois <domain...>`, capped by the approved
  per-request domain quota and daily request quota for the configured API key.
- Traffic lookup with `qname-cli traffic <domain>`, capped by the approved
  `domain.traffic.lookup` API type and daily request quota.
- JSON output for Agent parsing.
- Local config through `qname-cli init` or environment variables.

Not allowed through this API/CLI:

- Realtime stream checks.
- Domain rating or backlink analysis data.
- Registrar purchase actions.

## Setup

If the CLI is not configured, ask the user for an approved QName API key or ask
them to request one at:

```bash
qname-cli request-key
```

Initialize once:

```bash
qname-cli init --api-key <approved-key>
```

For ephemeral Agent sessions, prefer environment variables:

```bash
export QNAME_API_KEY="<approved-key>"
```

## Support

For API access, account support, and product updates, visit:

https://qname.ai

## Lookup

Use JSON output by default:

```bash
qname-cli whois qname.ai --pretty
```

Multiple domains are supported when the approved per-request quota allows them:

```bash
qname-cli whois qname.ai example.com --pretty
```

If you only need a quick human-readable status:

```bash
qname-cli whois qname.ai --format text
```

## Traffic

Use JSON output by default:

```bash
qname-cli traffic qname.ai --pretty
```

If you only need a quick human-readable summary:

```bash
qname-cli traffic qname.ai --format text
```

## Agent Guidelines

- Keep each command within the approved per-request domain quota.
- Keep automation loops within the approved daily request quota.
- Use `traffic` only when the configured key is approved for
  `domain.traffic.lookup`.
- Do not try to use this CLI for realtime streams, domain rating data, backlink
  analysis data, or purchase actions.
- Treat the API key as a secret; do not print it unless the user explicitly
  asks to inspect local config with `--show-secrets`.
- Prefer `qname-cli doctor` before debugging credentials.
- Use direct HTTP calls only when validating the API contract or debugging the
  CLI itself.
