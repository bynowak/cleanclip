# Security

Version 1.x receives security fixes. Report a vulnerability using this repository's private GitHub vulnerability reporting or email business@bynowak.com. Include a minimal synthetic fixture, affected version and impact. Do not post sensitive clipboard examples in public issues. No response deadline is promised.

The untrusted inputs are selected/pasted HTML and text, source URLs, stored preferences, and runtime messages. HTML is parsed without a DOM and rebuilt using a small semantic allowlist. Attributes are discarded except generated safe links and validated ordered-list start values. Link protocols are restricted to HTTP, HTTPS, mailto and tel; URL credentials are rejected. Scripts, CSS, event handlers, embedded content, forms and remote images are not retained.

Input size, parse-tree depth and node count are bounded. Copy failures do not prevent ordinary browser copying. Content-script messages must originate from this extension; there is no externally connectable API or web-accessible script. Automatic copy ignores synthetic copy events and password fields. Preferences are validated before use.

The extension requests no clipboard-read permission, does not keep clipboard history and makes no network calls. Its page-selection capability is powerful despite local processing: review the source and approve optional website access only if automatic cleaning is desired. Disabling and revoking access are separate controls. Browser/OS clipboard history and other extensions are outside this threat model.

For releases, verify the ZIP contains only the production build and no debug profile, credentials, source maps or remote script references. Do not add remote code, analytics, telemetry or a sync service without an explicit architecture/privacy review and updated public disclosures. Never commit store API keys, OAuth credentials or extension signing keys.
