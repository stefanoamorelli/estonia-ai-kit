# EMTA CLI Skill

Interact with the Estonian Tax and Customs Board (EMTA) through the `emta` tool. Authenticate via Smart-ID QR code, list and view TSD (Income and Social Tax Return) declarations.

## Pre-flight: Check Authentication

The EMTA CLI uses Smart-ID QR code authentication. Sessions expire after ~30 minutes.

If a command fails with "session expired" or similar, the user needs to re-authenticate:

```bash
emta login
```

Login is interactive. A QR code will be displayed in the terminal. Tell the user to scan it with their Smart-ID app. After scanning, the user will be prompted to select a principal (company or person).

To clear the session:

```bash
emta logout
```

## Commands

### List TSD declarations

```bash
emta tsd list              # current year
emta tsd list --year 2025  # specific year
```

### Show TSD declaration details

```bash
emta tsd show <declaration-id>
```

Get the declaration ID from `tsd list`.

## Important

- Login is always interactive (Smart-ID QR code). Ask the user to scan when running `login`.
- If you get "session expired", the user needs to run `login` again.
- Sessions expire after ~30 minutes server-side.
- Do not hardcode company or person names.
