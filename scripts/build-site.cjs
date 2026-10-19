// Generate direct-entry pages from the same forms used by client navigation.
// No packages or browser downloads are required to build on Vercel.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const out = path.join(root, 'dist');
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context = vm.createContext({esc: escapeHTML});
const pagesStart = source.indexOf('const pages=');
const helpersStart = source.indexOf('const field=', pagesStart);
const helpersEnd = source.indexOf("const appearanceKey=", helpersStart);
const formsStart = source.indexOf('function homeTools(');
const formsEnd = source.indexOf("let path='/'", formsStart);
if ([pagesStart, helpersStart, helpersEnd, formsStart, formsEnd].some(i => i < 0)) throw Error('Application template markers changed');
vm.runInContext(source.slice(pagesStart, helpersStart) + source.slice(helpersStart, helpersEnd) + source.slice(formsStart, formsEnd) + '\nglobalThis.routes=pages;globalThis.render=pageForm;', context);
const privateRoutes = new Set(['/account', '/projects', '/settings', '/feedback', '/admin']);
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
// Retain verification, ads, robots, manifest, service worker and standalone docs.
for (const name of fs.readdirSync(root)) {
  if (/\.(html|txt|png|webp|ico|svg|json|webmanifest|js)$/.test(name) && name !== 'index.html') {
    fs.copyFileSync(path.join(root, name), path.join(out, name));
  }
}
const logo = source.match(/<img src="data:image\/(webp|png);base64,([^"]+)"[^>]*class="brand-logo"/);
if (!logo) throw Error('Existing brand logo not found');
fs.writeFileSync(path.join(out, 'qbar-logo.' + logo[1]), Buffer.from(logo[2], 'base64'));
// One shared logo replaces both embedded copies, including the export branding.
// Content-addressed assets can be cached across routes without serving stale code.
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, {recursive: true});
function writeAsset(name, extension, content) {
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  const url = '/assets/' + name + '.' + hash + '.' + extension;
  fs.writeFileSync(path.join(out, url), content);
  return url;
}
const logoURL = writeAsset('qbar-logo', logo[1], Buffer.from(logo[2], 'base64'));
let template = source.split('data:image/' + logo[1] + ';base64,' + logo[2]).join(logoURL);
// Cache the small brand-name font locally; no third-party font request at runtime.
const fontMatch = template.match(/data:font\/woff;base64,([A-Za-z0-9+/=]+)/);
if (!fontMatch) throw Error('Brand font missing');
const fontURL = writeAsset('cinzel-decorative-brand', 'woff', Buffer.from(fontMatch[1], 'base64'));
template = template.replace(fontMatch[0], fontURL);
// Keep all classic scripts together: function hoisting is needed by account
// navigation on direct entry. Defer preserves DOM readiness and dependency order.
const scripts = [];
template = template.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (tag, attributes, body) => {
  if (/\bsrc\s*=|\btype\s*=/.test(attributes) || !body.trim()) return tag;
  scripts.push(body);
  return '';
});
const scriptURL = writeAsset('qbar-app', 'js', scripts.join('\n;\n'));
template = template.replace('</body>', '<script defer src="' + scriptURL + '"></script></body>');
const publicRoutes = [];
const rewrites = [];
for (const [route, [label, description]] of Object.entries(context.routes)) {
  const title = (route === '/' ? 'Free QR Code & Barcode Generator Online' : label) + ' | QBar Code Studio';
  const canonical = 'https://qbarcode.vercel.app' + route;
  const robots = privateRoutes.has(route) ? 'noindex,follow' : 'index,follow';
  let html = template.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHTML(title) + '</title>')
    .replace(/(<meta name="description" content=")[^"]*/, '$1' + escapeHTML(description))
    .replace(/(<meta name="robots" content=")[^"]*/, '$1' + robots)
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + canonical)
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + escapeHTML(title))
    .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + escapeHTML(description))
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + canonical)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, '$1' + escapeHTML(title))
    .replace(/(<meta name="twitter:description" content=")[^"]*/, '$1' + escapeHTML(description))
    .split('https://qbarcode.vercel.app/qbar-logo.png').join('https://qbarcode.vercel.app/qbar-logo.' + logo[1]);
  const intro = route === '/'
    ? `<section class="hero">
        <div class="eyebrow">✧ 100% FREE ONLINE QR CODE &amp; BARCODE STUDIO</div>
        <h1>Free Online <em>QR Code &amp; Barcode</em> Studio</h1>
        <p>Create custom branded QR codes with logos, 1D/2D retail barcodes (CODE128, EAN-13, UPC-A, Code 39), bulk printable label sheets, and high-resolution vector SVG/PNG export. Zero sign-up, no scan limits, 100% private in-browser generation.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:18px 0 6px;">
          <span style="background:rgba(40,90,67,0.12);color:var(--accent,#285a43);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">🛡️ 100% Free Forever</span>
          <span style="background:rgba(40,90,67,0.12);color:var(--accent,#285a43);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">⚡ Never Expires (No 14-Day Traps)</span>
          <span style="background:rgba(40,90,67,0.12);color:var(--accent,#285a43);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">📐 Vector SVG &amp; 300 DPI PNG</span>
          <span style="background:rgba(40,90,67,0.12);color:var(--accent,#285a43);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">🔒 100% Client-Side Privacy</span>
          <span style="background:rgba(40,90,67,0.12);color:var(--accent,#285a43);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">🖨️ Bulk Label Sheets Ready</span>
        </div>
      </section>`
    : '<div class="intro"><div class="eyebrow">QBar Code Studio</div><h1>' + escapeHTML(label) + '</h1><p>' + escapeHTML(description) + '</p></div>';
  const seoGuide = route === '/' ? `
<section class="info" style="margin-top:36px;border-radius:14px;line-height:1.75;">
  <div style="background:linear-gradient(135deg,rgba(40,90,67,0.08),rgba(40,90,67,0.02));border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:28px;">
    <span style="display:inline-block;background:#285a43;color:#fff;font-size:11px;font-weight:800;letter-spacing:1.2px;padding:4px 10px;border-radius:4px;text-transform:uppercase;margin-bottom:8px;">★ 100% Free Forever Guarantee</span>
    <h2 style="font-size:22px;margin:6px 0 10px;color:var(--text);">All-in-One Free Online QR Code &amp; Barcode Studio — No Expiry &amp; Zero Scan Limits</h2>
    <p style="margin:0;font-size:14px;color:var(--muted);">QBar Code Studio is an advanced browser-based barcode generator, QR code designer, and real-time camera scanner built for retail businesses, logistics managers, developers, and creators. Generate high-resolution vector barcodes and custom branded QR codes directly inside your web browser with zero sign-up required, no paywalls, no watermark restrictions, and permanent lifetime functionality.</p>
  </div>
  
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:32px;">
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Custom QR Codes with Branded Logos</h3>
      <p style="font-size:13px;margin:0;">Create personalized QR codes for website URLs, social media links, Google reviews, Wi-Fi network credentials, vCard contact cards, and business portfolios. Embed custom center logos, adjust corner radiuses, pick color palettes, and download crisp vector SVG or high-DPI PNGs.</p>
    </div>
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Retail &amp; Inventory Barcodes (1D &amp; 2D)</h3>
      <p style="font-size:13px;margin:0;">Generate standard 1D linear barcodes including CODE128 (shipping and logistics), EAN-13 (international consumer retail goods), UPC-A (supermarket POS), Code 39 (industrial/defense), and ITF-14 (carton packaging). Download clean vector SVG or high-resolution PNG formats ready for thermal printing.</p>
    </div>
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Bulk Printable Label Sheets</h3>
      <p style="font-size:13px;margin:0;">Prepare multi-row inventory label sheets for stock tracking and warehouse management. Customize label width, height, columns, margins, and print directly to standard A4 or adhesive sticker paper sheets.</p>
    </div>
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Real-Time Camera Scanner &amp; Image Upload</h3>
      <p style="font-size:13px;margin:0;">Scan any QR code or physical barcode instantly using your smartphone camera or desktop webcam, or upload gallery screenshots and image files. Decodes URLs, product serial numbers, and vCard contacts with zero external apps.</p>
    </div>
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Wi-Fi &amp; vCard QR with Profile Photo</h3>
      <p style="font-size:13px;margin:0;">Generate frictionless Wi-Fi access QR codes for cafes, hotels, and offices, or digital business contact cards with embedded profile photos, email, phone numbers, and company titles that save to phone address books with a single tap.</p>
    </div>
    <div style="background:var(--soft);padding:20px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">AI Paper Sheet Scanner (Invoices to Barcodes)</h3>
      <p style="font-size:13px;margin:0;">Take a photo of printed stock sheets, physical tables, or paper delivery invoices. Our camera tool extracts EAN and Article numbers, instantly rendering dual-code barcode label sheets for high-speed stock intake.</p>
    </div>
  </div>

  <h2 style="font-size:20px;margin-top:32px;margin-bottom:12px;color:var(--text);">Static vs. Dynamic QR Codes: Why QBar Codes Never Expire</h2>
  <p style="font-size:14px;color:var(--muted);">Many commercial QR code generators on the internet employ a predatory business model known as the <em>14-day trial trap</em>. When you create a dynamic QR code on those platforms, they encode their own middleman redirect URL rather than your actual website or contact info. Once you have printed thousands of brochures, business cards, restaurant menus, or retail packaging boxes, they disable the redirect link and demand $15 to $35 per month to keep your printed codes alive.</p>
  <p style="font-size:14px;color:var(--muted);"><strong>QBar Code Studio takes the opposite approach:</strong> every QR code generated here is a 100% static, independent barcode. Your destination URL, text, Wi-Fi credentials, or vCard data are encoded directly into the pixel matrix itself. There is no middleman redirect server, no database dependency, and no tracking intermediary. Because the data lives inside the physical code pattern, your QR codes will scan and work permanently, today, tomorrow, and 20 years from now with zero fees.</p>

  <h2 style="font-size:20px;margin-top:32px;margin-bottom:12px;color:var(--text);">Complete Guide to Supported Barcode Symbologies &amp; Standards</h2>
  <p style="font-size:14px;color:var(--muted);">Choosing the appropriate barcode symbology is essential for retail compliance, logistics tracking, and point-of-sale scanner compatibility:</p>
  <ul style="font-size:13px;color:var(--muted);padding-left:22px;line-height:1.85;">
    <li><strong>CODE128:</strong> A high-density alphanumeric linear barcode format capable of encoding all 128 ASCII characters. It is the international standard for shipping container labels, logistics tracking (GS1-128), freight dispatch (FedEx, UPS, DHL), and pharmaceutical inventory.</li>
    <li><strong>EAN-13 (International Article Number):</strong> The 13-digit global retail standard required for consumer packaged goods (CPG) scanned at supermarket and retail POS checkouts across Europe, Asia, Latin America, Australia, and worldwide.</li>
    <li><strong>UPC-A (Universal Product Code):</strong> The 12-digit North American retail barcode standard used on consumer goods throughout the United States and Canada.</li>
    <li><strong>Code 39:</strong> An industrial standard supporting uppercase alphanumeric characters and symbols, extensively used in automotive manufacturing, defense contracting, and internal warehouse asset tracking.</li>
    <li><strong>ITF-14 (Interleaved 2 of 5):</strong> A high-tolerance barcode printed with thick protective bearer bars, engineered specifically for corrugated cardboard shipping cartons and wholesale distribution.</li>
  </ul>

  <h2 style="font-size:20px;margin-top:32px;margin-bottom:12px;color:var(--text);">Professional Printing Guidelines: High-Resolution Vector SVG &amp; DPI</h2>
  <p style="font-size:14px;color:var(--muted);">To ensure 100% first-pass scanning reliability across all physical laser scanners and smartphone cameras, follow these essential design and print rules:</p>
  <ul style="font-size:13px;color:var(--muted);padding-left:22px;line-height:1.85;">
    <li><strong>Always Prefer Scalable Vector SVG for Commercial Print:</strong> Unlike raster PNG or JPEG images that become pixelated and fuzzy when enlarged, vector SVG files scale to billboard size with infinite mathematical sharpness.</li>
    <li><strong>Maintain the Mandatory Quiet Zone Margin:</strong> Always preserve an unprinted border (quiet zone) of at least 4 modules around QR codes and 10 times the narrowest bar width around linear barcodes. Without this white border, camera sensors cannot determine where the barcode begins.</li>
    <li><strong>High Optical Contrast:</strong> Always keep dark bars or dots on a pure white or bright background. Avoid inverted white-on-black barcodes or low-contrast pastels that fail optical laser sensors.</li>
    <li><strong>Minimum Physical Dimensions:</strong> For standard business cards, menus, and product labels, ensure QR codes are printed at a minimum of 20 mm &times; 20 mm (0.8 &times; 0.8 inches). For 1D barcodes, maintain at least 30 mm width &times; 15 mm height.</li>
  </ul>

  <h2 style="font-size:20px;margin-top:32px;margin-bottom:12px;color:var(--text);">Custom Branded QR Codes &amp; Reed-Solomon Error Correction Levels</h2>
  <p style="font-size:14px;color:var(--muted);">QR codes feature built-in Reed-Solomon error correction that reconstructs damaged or obscured pixels. When embedding your company logo or contact photo in the center of a QR code, choosing the right level ensures instant readability:</p>
  <ul style="font-size:13px;color:var(--muted);padding-left:22px;line-height:1.85;">
    <li><strong>Level L (Low - 7% Recovery):</strong> Best for simple, unbranded URL codes where maximum data density and smallest dot size are desired.</li>
    <li><strong>Level M (Medium - 15% Recovery):</strong> The balanced default suitable for most marketing flyers, menus, and product packaging.</li>
    <li><strong>Level Q (Quartile - 25% Recovery):</strong> Recommended when adding small icons or corner badges without compromising scanning speed.</li>
    <li><strong>Level H (High - 30% Recovery):</strong> Highly recommended when placing bold company logos, custom emblems, or vCard profile photos in the center. Even if up to 30% of the QR matrix is obscured by your graphic, camera sensors instantly reconstruct the underlying data.</li>
  </ul>

  <h2 style="font-size:20px;margin-top:36px;margin-bottom:14px;color:var(--text);">Frequently Asked Questions (FAQ)</h2>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Is QBar Code Studio completely free for personal and commercial use?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes, QBar Code Studio is 100% free with unlimited generation and high-resolution exports for both personal and commercial projects. There are no subscriptions, no credit card requirements, and no paywalls.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Do generated QR codes ever expire, or are there scan limits?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">No. Unlike subscription-based QR services that disable your codes after a 14-day trial, QBar Code Studio generates permanent static QR codes that encode data directly into the matrix. They never expire and have zero scan limits.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">How does QBar Code Studio protect my privacy?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">QBar Code Studio operates entirely client-side inside your browser. Your URLs, contact details, Wi-Fi passwords, and barcodes are never transmitted to, logged on, or tracked by any external server.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Which barcode and QR formats are supported?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">We support CODE128, EAN-13, UPC-A, Code 39, ITF-14, along with URL, plain text, Wi-Fi network credentials, vCard contact cards with photos, business profile cards, email, SMS, and custom styled QR codes with logos.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Can I add a custom company logo or photo to my QR code or vCard?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes. You can upload any PNG, WebP, or SVG logo, customize its shape (circle, rounded, square), add borders, and adjust error correction levels (Level H / 30%) to ensure rapid scanning.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Can I export scalable vector SVG files for professional printing?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes. Every QR code and barcode can be exported as scalable vector SVG files or high-DPI PNGs, perfect for billboards, product packaging, books, stickers, and industrial thermal label printers.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">What is the difference between CODE128, EAN-13, and UPC-A barcodes?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">CODE128 is a high-density alphanumeric format used for logistics, shipping, and inventory. EAN-13 is the 13-digit international retail standard used across Europe, Asia, and globally. UPC-A is the 12-digit standard used for retail consumer goods across the United States and Canada.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Can I generate and print bulk barcode labels on adhesive sheets?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes. Our Bulk Barcode &amp; Labels tool allows you to create multi-row product label sheets with custom column layouts, margins, item descriptions, and prices ready for standard A4 and sticker printing.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Does QBar Code Studio work offline without an internet connection?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes. QBar Code Studio is a Progressive Web App (PWA) with full service worker caching. You can install it on your Android, iOS, or desktop device and generate or scan codes anywhere without an internet connection.</p>
  </details>
  <details style="margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:12px;">
    <summary style="font-weight:700;cursor:pointer;color:var(--text);">Can I scan paper invoices or stock sheets to generate barcodes automatically?</summary>
    <p style="font-size:13px;margin-top:8px;color:var(--muted);">Yes. Our AI Sheet Scanner allows you to take a photo or upload an image of a printed invoice or inventory table, automatically extracts Article and EAN numbers, and generates printable dual-barcode sheets in seconds.</p>
  </details>
</section>` : '';
  html = html.replace('<main class="main" id="main" tabindex="-1"></main>', '<main class="main" id="main" tabindex="-1">' + intro + context.render(route) + seoGuide + '<noscript><p>Enable JavaScript to generate, scan and download codes.</p></noscript></main>');
  html = html.replace('<body', '<body data-page="' + route + '"');
  // Preserve existing about.html/privacy.html/terms.html URLs as redirects below.
  const filename = route === '/' ? 'index.html' : 'pages' + route + '.html';
  fs.mkdirSync(path.dirname(path.join(out, filename)), {recursive: true});
  fs.writeFileSync(path.join(out, filename), html);
  if (route !== '/') rewrites.push({source: route, destination: '/' + filename});
  if (!privateRoutes.has(route)) publicRoutes.push(canonical);
}
for (const alias of ['/inventory/labels', '/inventory/stock']) rewrites.push({source: alias, destination: '/pages/barcode/bulk.html'});
if (fs.existsSync(path.join(root, 'pages', 'app.html'))) {
  fs.mkdirSync(path.join(out, 'pages'), {recursive: true});
  fs.copyFileSync(path.join(root, 'pages', 'app.html'), path.join(out, 'pages', 'app.html'));
  rewrites.push({source: '/app', destination: '/pages/app.html'});
}
fs.writeFileSync(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + publicRoutes.map(url => '  <url><loc>' + url + '</loc></url>').join('\n') + '\n</urlset>\n');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (JSON.stringify(config.rewrites) !== JSON.stringify(rewrites)) throw Error('Vercel routes do not match the application routes');
console.log('Built ' + Object.keys(context.routes).length + ' pages; sitemap contains ' + publicRoutes.length + ' public URLs.');
