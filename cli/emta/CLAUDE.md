# emta

CLI for Estonian Tax and Customs Board (EMTA) e-services. Binary at `./emta` (or build with `go build -o emta .`).

## Using the CLI

### Login (interactive, requires user to scan QR code)

```sh
./emta login
```

Session is stored in the OS keychain (encrypted). Expires after ~30 minutes.

### Logout

```sh
./emta logout
```

### List TSD declarations

```sh
./emta tsd list              # current year
./emta tsd list --year 2025  # specific year
```

### Show TSD declaration summary (tax codes 110-119)

```sh
./emta tsd show <declaration-id>
```

Get the declaration ID from `tsd list`.

## Notes

- Login is interactive (Smart-ID QR code) — ask the user to scan when running `login`
- If you get "session expired", the user needs to run `login` again
- Do not hardcode company/person names
