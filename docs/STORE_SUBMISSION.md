# Chrome Web Store and Edge Add-ons submission

Status: packages/listings prepared; publisher registration and store review are pending. No store link or approved listing exists yet.

## Owner steps

Chrome Web Store requires a developer account and a one-time registration payment. The account owner must sign in, complete registration/payment, accept the applicable terms, verify contact details and configure account security. See the official [developer registration guide](https://developer.chrome.com/docs/webstore/register/) and [publishing guide](https://developer.chrome.com/docs/webstore/publish).

Edge Add-ons uses Microsoft Partner Center developer registration. Follow the official [Edge extension publication guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension). Complete any identity/contact verification and publisher agreements personally. Do not send passwords or payment details to repository issues or this project.

Once registered, create a new extension listing, upload `artifacts/cleanclip-1.0.0-chromium.zip`, and fill the listing using docs/store/LISTING.md. Use the generated icons/screenshots and a publicly accessible privacy-policy URL, initially `https://github.com/bynowak/cleanclip/blob/main/PRIVACY.md`. If a store requires a standalone page, publish the same policy on the publisher's website and update the URL. Review all publisher identity/category/distribution declarations before submitting.

## Privacy declarations

Single purpose: **Clean user-selected/copied text locally while preserving useful structure.**

Remote code: **No**. All code is bundled. Network transmission: **None**. Data collection: **None**. Processing copied text locally is still functionality that should be clearly disclosed; use PRIVACY.md and the permission justifications below. Do not claim that the extension cannot access page selections—it needs that access to do its job.

Use the dashboard's current wording when completing required data-use certifications. The publisher must personally confirm any legal attestations. No advertising, analytics, identity collection, account features, sale/transfer of data or unrelated data use exists in v1.

## Permission justifications

- `storage`: saves cleaning settings on the current device; never saves clipboard text.
- `activeTab`: grants one-off selection access only after the user invokes the extension.
- `scripting`: installs the isolated selection/copy handler and registers automatic handling after opt-in.
- `clipboardWrite`: writes the user's requested transformed clipboard content in plain, Markdown or rich format.
- Optional HTTP/HTTPS host access: enables ordinary website copy interception after the user explicitly enables automatic cleaning; the user can disable or revoke it.

No `clipboardRead`, `tabs`, `webRequest`, `history`, notifications, broad required host permissions or remote code permissions are declared in the release manifest.

## Reviewer test notes

No login or remote service is needed. Load the extension, open its toolbar popup, click Try sample, choose Markdown, inspect both panes and click Copy cleaned text. Paste into an editor. Switch output to Clean rich text and test a rich editor. The Writing preset removes destinations and uses straight quotes. Settings persist; preview content does not.

For automatic mode, enable the switch and approve website access; reload an ordinary HTTP/HTTPS page, select an article and copy with the normal keyboard shortcut. Disable to restore ordinary copying. Revoke website access from settings. Browser-internal/store pages are restricted; pasting into the popup is the fallback.

## Assets and updates

See the current [Chrome image requirements](https://developer.chrome.com/docs/webstore/images). The provided small promotional tile is 440×280; screenshots are 1280×800; icon is 128×128. Assets show actual sample-based UI and make no fabricated usage claims. Confirm each store's current validation requirements at submission time.

Keep review feedback and listing metadata in maintainer records. For a rejected build, fix the concrete issue, rerun checks, increment the version when required and submit again. Never add permissions or telemetry merely to satisfy a guess about review requirements.
