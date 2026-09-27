## What changed

Describe the developer task, bug, or documentation gap this pull request addresses.

## Public API contract

Which existing Aircraft Intelligence API route or behavior does this change rely on?

- [ ] Exact N-number lookup
- [ ] Bounded discovery
- [ ] Observed history
- [ ] Server-only authentication/error handling
- [ ] Documentation or packaging only

## Boundary review

- [ ] No API key or credential is exposed to browser code, URLs, logs, screenshots, fixtures, or committed files.
- [ ] No owner-name reverse search, unfiltered registry walk, fuzzy search, Mode S reverse lookup, global coverage, flight tracking, or other unsupported capability is implied.
- [ ] History changes preserve observation-time vs legal/source-effective-time semantics.
- [ ] No retained personal information is reconstructed around current FAA withholding.
- [ ] Public copy contains no internal roadmap/codename language.

## Validation

- [ ] `pnpm check`
- [ ] `git status --short` is clean
- [ ] UI screenshots, if changed, were reviewed with `docs/screenshots/README.md`
