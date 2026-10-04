# Screenshots

`popup.png` and `settings.png` are real captures of the built extension, using the explicitly labelled **Try sample** fixture. They contain no personal clipboard or browsing data.

To refresh them:

```sh
pnpm exec playwright install chromium
pnpm build
pnpm verify:extension
```

The script opens actual extension pages. Popup capture shows the compact UI as a page; Chrome's native toolbar popup can constrain height and scroll. Take a separate manual toolbar screenshot for store reviews if requested. Headless browsers do not assign OS accelerators, so **Unassigned** in a headless screenshot is accurate.

Store images are generated separately at required dimensions from these real UI captures. Run `node scripts/store-assets.mjs` after the acceptance capture. Review every image before submission; never use real user documents or imply unapproved store availability.
