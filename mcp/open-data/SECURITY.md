## Tallinn Secure Software Practices for OSS

_A security baseline from the OWASP Tallinn Chapter_

This project follows the **Tallinn Secure Software Practices for OSS**, developed to help open source maintainers and contributors build and maintain secure software. It provides a baseline of practical security practices informed by OWASP.

---

## Reporting Security Issues

If you discover a security vulnerability, please report it privately and responsibly.  
Do not create a public GitHub issue.

**Contact:**  
- Email: `stefano@amorelli.tech`  

We will acknowledge your report within *7 business days* and aim to resolve confirmed issues within 90 days or faster, depending on severity. Credit will be given unless anonymity is requested.

---

## Secure Development Practices

### Secrets and Credentials
- Never commit secrets (API keys, passwords, tokens) to the codebase.
- Use environment variables or secret managers (e.g., Vault, GitHub Actions secrets).
- Enable secret scanning and use pre-commit hooks to prevent accidental leaks.

### Dependencies and Supply Chain
- Pin dependencies and avoid using unmaintained packages.
- Use automated tools (e.g., Dependabot, OSV Scanner) to identify known vulnerabilities.
- Review and verify new dependencies before adding them.
- Consider generating an SBOM (Software Bill of Materials) for major releases.

### Code and Commit Hygiene
- All changes must go through pull requests with at least one code review.
- Protect the main branch (e.g., require PRs, reviews, passing CI).
- Encourage signed commits and signed release tags.
- Avoid force-pushes and direct commits to protected branches.

### CI/CD and Build Security
- Run builds in isolated, ephemeral environments.
- Use least-privilege CI tokens and restrict access to secrets.
- Review third-party CI/CD actions and pin versions or SHAs.
- Do not deploy unreviewed code to production environments.

---

## Vulnerability Handling Process

Once a vulnerability is confirmed:

1. It is triaged and, if valid, addressed privately.
2. A patch is prepared and tested.
3. A security advisory is published (with CVE if applicable).
4. A new version is released with the fix.
5. Acknowledgment is given to the reporter if appropriate.

---

## Contributor Expectations

All contributors are expected to:

- Follow secure coding practices (e.g., input validation, output encoding).
- Not introduce known vulnerable dependencies or unsafe constructs.
- Respect code review and CI checks before merging.
- Enable 2FA on GitHub or any platform with elevated access.
- **Sign and author your Git commits** using a verified identity.

### Commit Signing and Authorship

We require contributors to use **verified identities** in Git commits. Whenever possible, commits should be **GPG-signed** or **signed via GitHub’s verified web UI**.

This helps ensure:

- **Authenticity** – each change can be traced to a real, accountable contributor.
- **Integrity** – signed commits cannot be modified without detection.
- **Trust** – the project’s code history remains verifiable and auditable.

Unsigned or anonymous commits may be flagged and rejected in pull requests, especially for contributors with elevated privileges. See [GitHub’s documentation on signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) to get started.

---

## References and Resources

- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices/)
- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [OpenSSF Best Practices](https://openssf.org/best-practices/)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)
- [disclose.io Safe Harbor Terms](https://disclose.io/)

---

**Maintained by:** The OWASP Tallinn Chapter  
For updates or suggestions, visit: [https://owasp.org/www-chapter-tallinn](https://owasp.org/www-chapter-tallinn)
