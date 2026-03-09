# EMTA Plugin for Claude Code

Claude Code plugin for interacting with the Estonian Tax and Customs Board (EMTA). Authenticate via Smart-ID QR code, list and view TSD (Income and Social Tax Return) declarations.

> [!IMPORTANT]
> This plugin is experimental and not affiliated with the Estonian Tax and Customs Board (EMTA) or any Estonian government institution. It requires the emta-cli binary to be built and available on your PATH.

## Prerequisites

Build the EMTA CLI from the [estonia-ai-kit](https://github.com/stefanoamorelli/estonia-ai-kit) repository:

```bash
# Option 1: go install
go install github.com/stefanoamorelli/estonia-ai-kit/cli/emta@latest

# Option 2: build from source
git clone https://github.com/stefanoamorelli/estonia-ai-kit.git
cd estonia-ai-kit/cli/emta
go build -o emta-cli .
```

Ensure the binary is on your PATH.

## Install

```
/plugin marketplace add stefanoamorelli/estonia-ai-kit
/plugin install emta@estonia-ai-kit
```

## Security

This plugin accesses real tax data through an authenticated government session. Review agent actions before approving them.

Further reading: [OWASP Top 10 for LLM Applications](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) | [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)

## License

AGPL-3.0. See [LICENSE](../../LICENSE).

Copyright (c) 2025 [Stefano Amorelli](https://amorelli.tech)
