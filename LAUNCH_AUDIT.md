# QBar Code Studio — launch audit (15 October 2026)

## Checked locally
- Source: most recent Account Tabs Final `index.html`; retained without changing application behavior.
- HTML includes title, meta description, canonical URL, mobile viewport, Open Graph title/description, and dynamically rendered H1 on generator pages.
- JavaScript parser checks completed on inline scripts and decoded Firebase module.
- Vercel route rewrites supplied for client-side routes, to reduce direct-link 404s. Keep existing about/privacy/terms/robots/sitemap/Google verification files in GitHub.
- ZIP integrity checked.

## Still needs verification on deployed site
- The live URL could not be fetched by the audit tool; no live performance, security, mobile or QR/barcode behavior was verified.
- Test login, email sign-up, Google login, logout, QR/barcode generation, scanner permissions, downloads, project save/open/delete, direct routes, light/dark theme, mobile widths, and Firebase security rules.
- `og:image` currently references `/qbar-logo.png`. Confirm that image exists at the URL; if not, upload the correct image or remove/update the tag.
- Verify `robots.txt`, `sitemap.xml`, Google verification HTML and Search Console. They are not included in this package because their latest content wasn't supplied here.
- SPA pages rendered client-side may need pre-rendering for robust search indexing; route rewrites alone do not provide static SEO content.
- Cloud project 20-item limit is client-side, not securely enforced server-side. 90-day expiry is lazy cleanup when My Projects loads, not guaranteed scheduled deletion. Do not promise guaranteed automatic deletion at exactly 90 days.

## Deployment
1. In GitHub, replace `index.html` with the file in this package and add `vercel.json` at repository root.
2. Leave other existing files untouched.
3. Preview deployment first, then test `/projects`, `/account`, `/privacy` with direct URL refresh.
4. If all tests pass, promote to production.
