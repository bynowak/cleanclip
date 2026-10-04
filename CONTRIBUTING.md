# Contributing

Start with an issue describing an actual copy/paste failure. Provide a minimal, non-sensitive HTML/text fixture, selected preset, expected output and browser version. Never include personal documents, credentials, or private browsing data.

Use Node 22.13+ and pnpm 10.28.2:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Keep core transformations free of browser APIs and DOM access. Prefer conservative cleanup to guesses that destroy content. Add tests for the input, expected result, a near-miss case, and the security boundary where applicable. New runtime dependencies need a concrete reason and license review.

Use conventional commits, focused pull requests and the PR template. Run `pnpm format` before lint. Test the unpacked build when touching permissions, copy events, UI or the manifest; document any manual checks. Avoid mass reformatting and unrelated changes.

CI must pass. Changes to output semantics belong in the changelog; breaking settings/core API changes require versioning and migration decisions. Report security vulnerabilities privately following SECURITY.md.
