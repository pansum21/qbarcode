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
    ? '<section class="hero"><div class="eyebrow">✧ FREE QR CODE &amp; BARCODE GENERATOR</div><h1>Free Online <em>QR Code &amp; Barcode</em> Studio</h1><p>Create custom branded QR codes with logo styling, 1D/2D retail barcodes (CODE128, EAN-13, UPC-A, Code 39), bulk printable label sheets, and high-resolution vector SVG and PNG downloads.</p></section>'
    : '<div class="intro"><div class="eyebrow">QBar Code Studio</div><h1>' + escapeHTML(label) + '</h1><p>' + escapeHTML(description) + '</p></div>';
  const seoGuide = route === '/' ? `
<section class="info" style="margin-top:32px;border-radius:14px;line-height:1.7;">
  <h2 style="font-size:22px;margin-bottom:12px;color:var(--text);">All-in-One Free Online QR Code &amp; Barcode Generator</h2>
  <p>QBar Code Studio is an advanced web-based generator and real-time camera scanner designed for small businesses, warehouses, developers, and educators. Generate customizable vector barcodes and QR codes directly in your browser with zero sign-up required, no paywalls, and unlimited high-resolution downloads.</p>
  
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:20px;">
    <div style="background:var(--soft);padding:18px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Custom QR Codes with Logo</h3>
      <p style="font-size:13px;margin:0;">Create personalized QR codes for website URLs, Wi-Fi network credentials, vCard contact cards, business cards, and marketing campaigns. Embed custom center logos, adjust corner radiuses, pick color palettes, and preview live before downloading.</p>
    </div>
    <div style="background:var(--soft);padding:18px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Retail &amp; Inventory Barcodes</h3>
      <p style="font-size:13px;margin:0;">Generate standard 1D linear barcodes including CODE128 (logistics and shipping), EAN-13 (international consumer goods), UPC-A (retail POS), Code 39, and ITF-14. Download crisp vector SVG or high-DPI PNG formats ready for thermal printing.</p>
    </div>
    <div style="background:var(--soft);padding:18px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Bulk Printable Label Sheets</h3>
      <p style="font-size:13px;margin:0;">Prepare multi-row inventory label sheets for stock tracking and warehouse management. Customize label width, height, columns, margins, and print directly to standard A4 or adhesive label paper sheets.</p>
    </div>
    <div style="background:var(--soft);padding:18px;border-radius:10px;border:1px solid var(--line);">
      <h3 style="margin-top:0;font-size:16px;color:var(--accent);">Built-in Live Camera Scanner</h3>
      <p style="font-size:13px;margin:0;">Scan any QR code or physical barcode instantly using your smartphone or desktop webcam. Decodes URLs, product serial numbers, and contact info in real-time with zero external apps needed.</p>
    </div>
  </div>

  <h3 style="font-size:18px;margin-top:28px;margin-bottom:10px;color:var(--text);">Frequently Asked Questions</h3>
  <details style="margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:10px;">
    <summary style="font-weight:700;cursor:pointer;">Is QBar Code Studio completely free for commercial use?</summary>
    <p style="font-size:13px;margin-top:8px;">Yes, all generated QR codes and barcodes are 100% free with no expiry date, no scan limits, and no watermarks for personal and commercial projects.</p>
  </details>
  <details style="margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:10px;">
    <summary style="font-weight:700;cursor:pointer;">Can I download vector SVG files for professional printing?</summary>
    <p style="font-size:13px;margin-top:8px;">Yes, every code can be exported as scalable vector SVG or high-resolution PNG, ensuring razor-sharp edges on billboards, product boxes, stickers, or packaging.</p>
  </details>
  <details style="margin-bottom:10px;border-bottom:1px solid var(--line);padding-bottom:10px;">
    <summary style="font-weight:700;cursor:pointer;">Do generated QR codes ever expire?</summary>
    <p style="font-size:13px;margin-top:8px;">Static QR codes generated with QBar Code Studio encode data directly into the pixel matrix. They work indefinitely and will never expire.</p>
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
