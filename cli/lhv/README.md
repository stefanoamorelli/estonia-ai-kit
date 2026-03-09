# lhv-cli

CLI for LHV Bank. Authenticate with Smart-ID, view accounts and transactions, switch between personal and business profiles, and make SEPA payments.

> [!IMPORTANT]
> **Disclaimer**
>
> This project is **highly experimental** and can break at any time without notice. It is **not affiliated with, endorsed by, or supported by LHV Bank** in any way.
>
> This CLI interacts with LHV's web interface programmatically, using the same endpoints and pages that the browser-based banking application uses. These are internal, undocumented endpoints that LHV can change or deprecate at any time. There is no official public API, no stability guarantee, and no support from LHV for this usage.
>
> This tool **should not be used with real bank accounts or real money**. If you choose to do so regardless, you accept full responsibility. Mistakes, bugs, or misuse can result in actual financial transactions that may be difficult or impossible to reverse. Always review what you are running, keep your system and dependencies up to date, and never expose your session tokens or credentials. See the security notice below for additional context, especially if you plan to use this CLI with AI agents.
>
> This tool is intended for personal experimentation and educational purposes only. It should not be used in production environments, automated pipelines, or any context where reliability and security are required. It is provided "as is" without warranty of any kind. Use at your own risk. The authors take no responsibility for any financial loss, unauthorized transactions, account lockouts, security incidents, or other consequences resulting from using this tool. You are solely responsible for complying with your bank's terms of service.

> [!CAUTION]
> **Security Notice**
>
> When used as an AI agent skill, this CLI lets an LLM autonomously execute banking operations. This is vulnerable to [prompt injection](https://genai.owasp.org/llm-top-10/), [agent goal hijacking](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/), and [skills supply chain attacks](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/). Session cookies stored in your keyring grant full account access to anything that can read them.
>
> Never use `--dangerously-skip-permissions` in Claude Code with this skill. Always verify Smart-ID codes on your phone. Prefer running payments manually.
>
> Further reading: [OWASP Top 10 for LLM Applications](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) | [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) | [Prompt Injection on Agentic Coding Assistants (Maloyan & Namiot, 2026)](https://arxiv.org/abs/2601.17548) | [Claude Code Security](https://code.claude.com/docs/en/security)

## Install

```bash
git clone https://github.com/stefanoamorelli/lhv-cli.git
cd lhv-cli
make install
```

This installs the `lhv` binary to `~/.local/bin/` and sets up zsh completions.

## Usage

### Authenticate

Interactive (human):

```bash
lhv auth --interactive
```

Non-interactive (scripted/skill):

```bash
lhv auth --id <ESTONIAN_ID_CODE> --user-id <USER_ID> --account-id <ACCOUNT_ID>
```

Smart-ID verification code will be printed. Confirm it on your phone.

### Check session

```bash
lhv whoami
```

### List accounts

```bash
lhv get-accounts
```

### View transactions

```bash
lhv get-transactions --from 01.01.2025 --to 01.03.2025
```

Use `--raw` for CSV, `--limit 0` for all, `--interactive` for fuzzy search.

### Switch person/account

```bash
# List available persons (JSON)
lhv switch-account --list

# Switch non-interactively
lhv switch-account --user-id <USER_ID> --account-id <ACCOUNT_ID>

# Switch interactively (fzf)
lhv switch-account -i
```

### Make a SEPA payment

```bash
lhv pay \
  --from <SENDER_IBAN> \
  --to <RECIPIENT_IBAN> \
  --name "Recipient Name" \
  --amount "100.00" \
  --description "Invoice 123" \
  --confirm
```

Smart-ID signing is always required.

## Claude Code Skill

Install the bundled skill to use this CLI with Claude Code:

```bash
make install-skill
```

This copies `skills/lhv/SKILL.md` to `~/.claude/skills/lhv/`. See the [security notice above](#lhv-cli) before using it.

## Development

```bash
make build         # Build binary
make test          # Run tests
make vet           # Static analysis
make fmt           # Format code
make lint          # Vet + staticcheck
make check         # Format + vet + test
make clean         # Remove build artifacts
```

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

Copyright © 2025 [Stefano Amorelli](https://amorelli.tech) ([stefano@amorelli.tech](mailto:stefano@amorelli.tech))
