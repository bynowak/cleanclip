# Copy a web page into Markdown without bringing the mess

A practical guide for writers, researchers and developers using CleanClip. Free and open source; no account required.

## What this solves

Copying into an editor can carry unwanted fonts, colours and tracking parameters. Plain-text paste removes styling, but may discard useful structure. CleanClip converts selected website content into plain text, Markdown or sanitised rich text while preserving supported headings, lists, links, basic tables and code.

## Start with a small, safe selection

1. Install the Chromium release using [the repository instructions](https://github.com/bynowak/cleanclip#install-locally). Chrome and Edge require Developer mode and Load unpacked. There is no one-click store installation in this release.
2. Select a few paragraphs on an ordinary public web page.
3. Open the CleanClip popup and choose **Use page selection**.
4. Choose the **Markdown** preset and inspect the output.
5. Click **Copy cleaned text**, paste into your editor and review the result.

The default shortcut for cleaning a selection is `Alt+Shift+C`. Your browser or operating system may use it already; check the browser's extension shortcut settings.

## Choose the right output

| Task                | Starting preset | Review before using                             |
| ------------------- | --------------- | ----------------------------------------------- |
| Research notes      | Markdown        | Headings, source links and quotation boundaries |
| Prose draft         | Writing         | Quotes, punctuation and link labels             |
| Documentation       | Developer       | Code indentation, fences and table alignment    |
| Readable plain text | Plain           | Paragraph and list structure                    |

Keep the source URL in research notes. Cleaning text does not provide permission to reuse someone else's writing. Quote and attribute sources appropriately.

## A labelled illustration

This is an invented text example, not a product screenshot or customer result.

A selected heading and two linked list items can become editable Markdown:

```markdown
## Launch notes

- Review the [pricing page](https://example.com/pricing).
- Check the download instructions.
```

Tracking cleanup removes known parameters such as `utm_source`; functional query parameters and fragments are preserved. CleanClip does not follow redirect links. Removing tracking may also remove useful campaign attribution from a copied marketing URL, so keep an untouched original when attribution matters.

## Understand the limits

- Fonts, colours, embedded media and custom widgets are discarded.
- Basic tables work; merged cells are flattened with a warning. Check alignment.
- Some PDFs, custom editors, restricted pages and frame selections need manual paste into the popup.
- CleanClip performs formatting cleanup. It does not rewrite prose, fact-check text or improve a brand voice.

## Privacy and control

The extension processes supplied content locally, makes no network calls and stores no clipboard history. It saves preferences on your device. Automatic cleaning is optional and asks for website access when enabled. Keep it off if you only want explicit selection copying. See the [privacy policy](https://github.com/bynowak/cleanclip/blob/main/PRIVACY.md) for details.

## Next: make the words clearer

Formatting and messaging are different jobs. Use the free [10-minute landing page clarity check](https://github.com/bynowak/sitecheck/blob/main/docs/guides/clear-copy-checklist.md) to review your headline, offer and next step.

For feedback on one page and five social posts, ByNowak's existing **$120 Mini Audit** includes tone issues, rewritten examples and practical recommendations. English and Polish. [View services](https://bynowak.com/services?utm_source=github&utm_medium=referral&utm_campaign=cleanclip_workflow&utm_content=guide) or [inquire by email](mailto:business@bynowak.com?subject=Mini%20Audit%20enquiry).

ByNowak / Mateusz Nowak. October 18, 2026. An original educational guide, not a client case study.
