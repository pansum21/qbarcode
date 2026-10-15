// Generate direct-entry pages from the same forms used by client navigation.
// No packages or browser downloads are required to build on Vercel.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const out = path.join(root, 'dist');
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context = vm.createContext({esc: escapeHTML});
const pagesStart = source.indexOf('const pages=');
const helpersStart = source.indexOf('const field=', pagesStart);
const helpersEnd = source.indexOf("const appearanceKey=", helpersStart);
const formsStart = source.indexOf('function pageForm(');
const formsEnd = source.indexOf("let path='/'", formsStart);
if ([pagesStart, helpersStart, helpersEnd, formsStart, formsEnd].some(i => i < 0)) throw Error('Application template markers changed');
vm.runInContext(source.slice(pagesStart, helpersStart) + source.slice(helpersStart, helpersEnd) + source.slice(formsStart, formsEnd) + '\nglobalThis.routes=pages;globalThis.render=pageForm;', context);
const privateRoutes = new Set(['/account', '/projects', '/settings', '/feedback', '/admin']);
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
// Retain verification, ads, robots and existing standalone documents.
for (const name of fs.readdirSync(root)) {
  if (/\.(html|txt|png|webp|ico|svg)$/.test(name) && name !== 'index.html') fs.copyFileSync(path.join(root, name), path.join(out, name));
}
const logo = source.match(/<img src="data:image\/(webp|png);base64,([^"]+)"[^>]*class="brand-logo"/);
if (!logo) throw Error('Existing brand logo not found');
fs.writeFileSync(path.join(out, 'qbar-logo.' + logo[1]), Buffer.from(logo[2], 'base64'));
const publicRoutes = [];
const rewrites = [];
for (const [route, [label, description]] of Object.entries(context.routes)) {
  const title = (route === '/' ? 'Free QR Code & Barcode Generator Online' : label) + ' | QBar Code Studio';
  const canonical = 'https://qbarcode.vercel.app' + route;
  const robots = privateRoutes.has(route) ? 'noindex,follow' : 'index,follow';
  let html = source.replace(/<title>[^<]*<\/title>/, '<title>' + escapeHTML(title) + '</title>')
    .replace(/(<meta name="description" content=")[^"]*/, '$1' + escapeHTML(description))
    .replace(/(<meta name="robots" content=")[^"]*/, '$1' + robots)
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + canonical)
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + escapeHTML(title))
    .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + escapeHTML(description))
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + canonical)
    .replace('https://qbarcode.vercel.app/qbar-logo.png', 'https://qbarcode.vercel.app/qbar-logo.' + logo[1]);
  const intro = route === '/'
    ? '<section class="hero"><div class="eyebrow">✧ LESS TYPING. MORE CONNECTING.</div><h1>Big ideas. <em>Small codes.</em></h1><p>Make anything scannable. Free QR codes &amp; barcodes, in a few clicks.</p></section>'
    : '<div class="intro"><div class="eyebrow">QBar Code Studio</div><h1>' + escapeHTML(label) + '</h1><p>' + escapeHTML(description) + '</p></div>';
  html = html.replace('<main class="main" id="main" tabindex="-1"></main>', '<main class="main" id="main" tabindex="-1">' + intro + context.render(route) + '<noscript><p>Enable JavaScript to generate, scan and download codes.</p></noscript></main>');
  // Preserve existing about.html/privacy.html/terms.html URLs as redirects below.
  const filename = route === '/' ? 'index.html' : 'pages' + route + '.html';
  fs.mkdirSync(path.dirname(path.join(out, filename)), {recursive: true});
  fs.writeFileSync(path.join(out, filename), html);
  if (route !== '/') rewrites.push({source: route, destination: '/' + filename});
  if (!privateRoutes.has(route)) publicRoutes.push(canonical);
}
for (const alias of ['/inventory/labels', '/inventory/stock']) rewrites.push({source: alias, destination: '/pages/barcode/bulk.html'});
fs.writeFileSync(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + publicRoutes.map(url => '  <url><loc>' + url + '</loc></url>').join('\n') + '\n</urlset>\n');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (JSON.stringify(config.rewrites) !== JSON.stringify(rewrites)) throw Error('Vercel routes do not match the application routes');
console.log('Built ' + Object.keys(context.routes).length + ' pages; sitemap contains ' + publicRoutes.length + ' public URLs.');
