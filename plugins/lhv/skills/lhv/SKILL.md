# LHV Bank CLI Skill

Interact with LHV Bank through the `lhv` CLI -- check balances, view transactions, switch accounts, and make SEPA payments.

## Pre-flight: Check Authentication

Before any operation, verify the session is valid:

```bash
lhv whoami
```

If expired or not authenticated, authenticate first:

```bash
lhv auth --id <ESTONIAN_ID_CODE>
```

The auth command will:

1. Initiate Smart-ID authentication
2. Print a verification code -- tell the user to confirm it on their phone
3. Wait for smartphone confirmation (up to 2 minutes)
4. Save session to system keyring

## Discovery: Available Persons

To discover available person/user IDs (personal and business profiles), authenticate first then use:

```bash
lhv switch-account --list
```

This outputs JSON, useful for discovering IDs programmatically.

If the user has multiple persons (personal + business), pass `--user-id` and `--account-id` to skip interactive prompts:

```bash
lhv auth --id <ID_CODE> --user-id <USER_ID> --account-id <ACCOUNT_ID>
```

## Commands

### Check identity

```bash
lhv whoami
```

Shows the authenticated user, active person (Personal/Business), and session status.

### List accounts

```bash
lhv get-accounts
```

### View transactions

```bash
lhv get-transactions --portfolio <PORTFOLIO_ID> --from <DD.MM.YYYY> --to <DD.MM.YYYY>
```

Defaults to the current month if `--from`/`--to` are omitted. Use `--raw` for CSV output. Use `--limit 0` to show all.

### Switch person/account

List available persons:

```bash
lhv switch-account --list
```

Switch non-interactively:

```bash
lhv switch-account --user-id <USER_ID> --account-id <ACCOUNT_ID>
```

Use `-i` or `--interactive` to enable the interactive fzf prompt.

### Make a SEPA payment

```bash
lhv pay \
  --from "<SENDER_IBAN>" \
  --to "<RECIPIENT_IBAN>" \
  --name "<RECIPIENT_NAME>" \
  --amount "<AMOUNT>" \
  --description "<DESCRIPTION>" \
  --reference "<REFERENCE>" \
  --confirm
```

The `--confirm` flag skips the interactive confirmation prompt. Smart-ID signing is always required -- print the verification code and tell the user to confirm on their phone.

## Important

- Always run `lhv whoami` before any operation to check session status
- If session is expired, run `lhv auth` before retrying
- All interactive/fzf prompts are disabled by default -- pass `--interactive` to enable them
- For payments, always show the user a summary and ask for confirmation before running the command
- Smart-ID verification codes timeout after 2 minutes
- The `--list` flag on `switch-account` outputs JSON, useful for discovering IDs programmatically
