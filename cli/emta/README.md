# EMTA CLI

CLI for Estonian Tax and Customs Board (EMTA) e-services. Authenticates via Smart-ID QR code and provides access to TSD (Income and Social Tax Return) declarations plus KMD draft read/write tooling.

> [!IMPORTANT]
> **Unofficial, open source & experimental.** This is a community-driven project, part of [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit). It is not affiliated with, endorsed by, or connected to the Estonian Tax and Customs Board (EMTA) or any Estonian government institution. It relies on undocumented web interfaces (HTML parsing, internal redirect chains) that **can break at any time** without notice. Sessions expire after ~30 minutes. Use at your own risk. The authors accept no liability for any issues arising from its use.

> [!WARNING]
> **Security considerations for agentic use.** If you use this CLI as a skill for an AI agent (e.g., via shell access), be aware that you are granting the agent access to an authenticated government session containing sensitive tax data. Always review agent actions before approving them, and understand the risks of prompt injection and tool misuse in agentic workflows. Read more about agentic AI security:
>
> - [OWASP Top 10 for LLM & Generative AI](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
> - [OWASP Agentic AI Threats and Mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)
> - [MCP Security: Tool Poisoning Attacks (Invariant Labs)](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)

## Prerequisites

- [Go 1.21+](https://go.dev/dl/)
- Smart-ID account linked to your Estonian ID

## Install

```sh
go install github.com/stefanoamorelli/estonia-ai-kit/cli/emta@latest
```

Or build from source:

```sh
cd cli/emta
go build -o emta-cli .
```

## Usage

### Login

Authenticate via Smart-ID QR code. You'll be prompted to select a principal (company/person) after scanning.

```sh
./emta-cli login
```

Session is stored in the OS keychain (macOS Keychain, GNOME Keyring, Windows Credential Manager) and expires after ~30 minutes server-side.

To clear the saved session:

```sh
./emta-cli logout
```

### List TSD Declarations

```sh
./emta-cli tsd list              # current year
./emta-cli tsd list --year 2025  # specific year
```

### Show TSD Summary

```sh
./emta-cli tsd show <declaration-id>
```

Get the declaration ID from `tsd list`.

### KMD

List all KMD declarations:

```sh
./emta-cli kmd list
```

Read KMD main form:

```sh
./emta-cli kmd main read --declaration-id <id>
```

Update KMD main form from JSON:

```sh
./emta-cli kmd main update --declaration-id <id> --input main.json
```

Example input:

```sh
./examples/kmd-main.json
```

Read annex rows:

```sh
./emta-cli kmd inf-a read --declaration-id <id>
./emta-cli kmd inf-b read --declaration-id <id>
```

Update annex rows from JSON:

```sh
./emta-cli kmd inf-a update --declaration-id <id> --input inf-a.json
./emta-cli kmd inf-b update --declaration-id <id> --input inf-b.json
```

Example inputs:

```sh
./examples/kmd-inf-a.json
./examples/kmd-inf-b.json
```

Submit saved KMD draft:

```sh
./emta-cli kmd submit --declaration-id <id> --confirm
```

## How It Works

1. **Authentication**: Smart-ID QR code login via TARA (Estonia's national authentication service), following the full OIDC redirect chain through `tara.ria.ee` back to `maasikas.emta.ee`.

2. **Session persistence**: Access token and HTTP cookies are stored in the OS keychain (encrypted by default). This avoids writing sensitive credentials to plain text files on disk. Subsequent commands retrieve the session from the keychain without re-authenticating.

3. **TSD data**: The TSD application is server-rendered HTML. Data is extracted by parsing the HTML response since no JSON API is available.

4. **Principal selection**: When accessing TSD, the EMTA portal requires selecting a represented person/company via the WFM (Workflow Manager) subsystem.

## License

AGPL-3.0. See [LICENSE](./LICENSE).

Copyright (c) 2025 Stefano Amorelli
