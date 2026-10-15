# QBar Code Studio

Edit index.html as the application source. Build with:

    node scripts/build-site.cjs
    node scripts/check-seo.cjs

Vercel runs the build and serves dist/. The build renders the existing tool forms
and information pages into initial HTML, sets per-page metadata, extracts the
existing brand image, and generates the public sitemap. The same application
JavaScript handles navigation and generation.

Account, projects, settings, feedback, and admin pages are excluded from the
sitemap and marked noindex. Explicit rewrites preserve 404s for unknown paths.
The older about.html, privacy.html and terms.html URLs redirect to current pages.

Before production, verify preview direct-entry/refresh, QR/barcode generation and
downloads, account access, and mobile appearance. Local structural checks do not
replace real Vercel or browser testing.
