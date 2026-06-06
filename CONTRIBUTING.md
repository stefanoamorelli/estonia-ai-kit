# Contributing to Estonia AI Kit

Thanks for your interest in contributing! 🇪🇪 This guide covers the two
agreements every contribution must satisfy before it can be merged.

## TL;DR

1. **Sign off your commits** with `git commit -s` (Developer Certificate of
   Origin).
2. **Sign the CLA once** by commenting on your first pull request.

Both are checked automatically on every pull request.

## 1. Developer Certificate of Origin (DCO)

Every commit must carry a `Signed-off-by` line. This is your statement that you
wrote the code (or otherwise have the right to submit it) under the project
license — see [developercertificate.org](https://developercertificate.org).

Add it automatically with the `-s` flag:

```bash
git commit -s -m "feat: add my change"
```

This appends a trailer like:

```
Signed-off-by: Your Name <your.email@example.com>
```

Forgot to sign off? Fix it before pushing:

```bash
git commit --amend -s            # the latest commit
git rebase --signoff origin/main # the whole branch
git push --force-with-lease
```

The **DCO** check enforces this on every commit in your PR.

## 2. Contributor License Agreement (CLA)

The DCO certifies *where the code came from*. The [CLA](./CLA.md) goes one step
further: it grants the maintainer the rights needed to distribute, relicense,
and commercialize the project (for example, to dual-license it). You keep the
copyright to your contributions.

You only sign **once**. On your first pull request, an automated assistant will
ask you to comment:

> I have read the CLA Document and I hereby sign the CLA

Your signature is recorded against your GitHub username and applies to all your
future contributions.

## Pull request checklist

- [ ] Commits are signed off (`git commit -s`)
- [ ] CLA signed (one-time, via PR comment)
- [ ] Tests and linters pass locally (`npx nx affected --target=test,lint`)
- [ ] The PR description explains **why** the change is needed
