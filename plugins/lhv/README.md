# LHV Bank Plugin for Claude Code

Claude Code plugin for interacting with LHV Bank. Authenticate with Smart-ID, view accounts and transactions, switch between personal and business profiles, and make SEPA payments.

> [!IMPORTANT]
> This plugin is experimental and not affiliated with LHV Bank. It requires the [lhv-cli](https://github.com/stefanoamorelli/lhv-cli) binary to be installed and available on your PATH.

## Prerequisites

Install the LHV CLI from [github.com/stefanoamorelli/lhv-cli](https://github.com/stefanoamorelli/lhv-cli):

```bash
git clone https://github.com/stefanoamorelli/lhv-cli.git
cd lhv-cli
make install
```

## Install

```
/plugin marketplace add stefanoamorelli/estonia-ai-kit
/plugin install lhv@estonia-ai-kit
```

## Security

This plugin can execute real banking operations. Review the [security notice](https://github.com/stefanoamorelli/lhv-cli#lhv-cli) in the lhv-cli repository before use.

Further reading: [OWASP Top 10 for LLM Applications](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) | [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)

## License

AGPL-3.0. See [LICENSE](../../LICENSE).

Copyright (c) 2025 [Stefano Amorelli](https://amorelli.tech)
