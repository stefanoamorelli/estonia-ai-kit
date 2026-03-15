# LHV Bank Plugin for Claude Code

Claude Code plugin for interacting with LHV Bank. Authenticate with Smart-ID, view accounts and transactions, switch between personal and business profiles, and make SEPA payments.

> [!IMPORTANT]
> This plugin is experimental and not affiliated with LHV Bank. It requires the [lhv CLI](https://github.com/stefanoamorelli/estonia-ai-kit/tree/main/cli/lhv) binary to be installed and available on your PATH.

## Prerequisites

Install the LHV CLI from the [estonia-ai-kit](https://github.com/stefanoamorelli/estonia-ai-kit) repository:

```bash
go install github.com/stefanoamorelli/estonia-ai-kit/cli/lhv@latest
```

Or build from source:

```bash
git clone https://github.com/stefanoamorelli/estonia-ai-kit.git
cd estonia-ai-kit/cli/lhv
make install
```

## Install

```
/plugin marketplace add stefanoamorelli/estonia-ai-kit
/plugin install lhv@estonia-ai-kit
```

## Security

This plugin can execute real banking operations. Review the [security notice](https://github.com/stefanoamorelli/estonia-ai-kit/tree/main/cli/lhv#lhv-cli) before use.

Further reading: [OWASP Top 10 for LLM Applications](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) | [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)

## License

AGPL-3.0. See [LICENSE](../../LICENSE).

Copyright (c) 2025 [Stefano Amorelli](https://amorelli.tech)
