# Release procedure

1. Update package.json and public/manifest.json versions together. Update CHANGELOG.md. Keep Chrome's numeric manifest version constraints in mind.
2. Use the pinned pnpm with a frozen lockfile. Run typecheck, lint, tests, build and browser acceptance.
3. Manually load `dist/` in Chrome and Edge. Open the actual toolbar popup, use page selection, paste HTML, copy all three formats and paste into a plain editor and a rich editor. Test nested lists, tables and code.
4. Approve the native optional-site permission prompt. Reload a fixture page, copy normally, verify cleaned output. Disable automatic mode, then revoke access; normal copying must remain normal. Decline the permission prompt once and confirm one-off copying still works.
5. Verify actual OS shortcut assignment and dispatch, plus the UI's unassigned-shortcut handling. Test a restricted browser page, empty selection, password field and oversized selection.
6. Run `pnpm package`. The archive root must contain manifest.json, popup.html, options.html, background.js, content.js, assets and icons, not a wrapping `dist` directory. Check the ZIP and checksum.
7. Run the GitHub release workflow with `vX.Y.Z`, or push that tag. The workflow reruns checks and browser acceptance, packages the extension and attaches the ZIP plus SHA-256 file to a GitHub release.
8. Submit that exact reviewed ZIP to Chrome Web Store and Edge Add-ons. Store review/publication is a separate action from a GitHub release; do not promise an approval date. Retain a record of the submitted version and review outcome.

Build output contains no source maps or remote executable code. Do not include the test-results directory, developer profiles, source dependencies, or signing keys in a store ZIP. Store assets and listings are in docs/store and docs/STORE_SUBMISSION.md.

The automated acceptance test checks the production unpacked manifest and clipboard pipeline. Its separate automatic-copy permission fixture is confined to a disposable profile. It does not substitute for the native permission dialog and OS shortcut smoke checks above.
