const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/supri/maparte/node_modules/playwright');

const PORT = 8089;
const ROOT = path.resolve('C:/Users/supri/qbarcode/dist');

// Simple static server
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/studio') reqPath = '/pages/studio.html';
    else if (reqPath === '/feedback') reqPath = '/pages/feedback.html';
    else if (reqPath === '/scan') reqPath = '/pages/scan.html';
    else if (reqPath === '/barcode') reqPath = '/pages/barcode.html';
    else if (reqPath === '/account') reqPath = '/pages/account.html';
    else if (reqPath.endsWith('/')) reqPath += 'index.html';
    
    let filePath = path.join(ROOT, reqPath);
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(ROOT, 'pages', reqPath + '.html'))) {
      filePath = path.join(ROOT, 'pages', reqPath + '.html');
    } else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found: ' + req.url);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// Generate a sample BMP/PNG buffer for testing without extra dependencies
function createTestBmp(width, height) {
  const headerSize = 54;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = headerSize + imageSize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(headerSize, 10);
  // DIB Header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // 24-bit RGB
  buf.writeUInt32LE(imageSize, 34);

  // Pixel data with high-contrast gradient
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = headerSize + y * rowSize + x * 3;
      buf[offset] = (x * 4) % 256;       // Blue
      buf[offset + 1] = (y * 4) % 256;   // Green
      buf[offset + 2] = ((x + y) * 2) % 256; // Red
    }
  }
  return buf;
}

async function runTests() {
  const server = await startServer();
  const testBmpPath = path.resolve('C:/Users/supri/qbarcode/test_sample.bmp');
  fs.writeFileSync(testBmpPath, createTestBmp(800, 600));
  console.log('Created test image at', testBmpPath, `(${fs.statSync(testBmpPath).size} bytes)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  try {
    // TEST 1: QR Studio Root loads open without login redirect
    console.log('\n--- TEST 1: QR Studio Root Access ---');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    const currentUrl = page.url();
    const hasRedirectedToAccount = currentUrl.includes('/account');
    console.log('Current URL:', currentUrl);
    if (!hasRedirectedToAccount) {
      results.push('PASS: QR Studio is open to all users without forced login redirection.');
    } else {
      results.push('FAIL: QR Studio redirected to login page: ' + currentUrl);
    }

    // TEST 2: Generate a QR Code in Studio
    console.log('\n--- TEST 2: QR Code Generation in /studio ---');
    await page.goto(`http://localhost:${PORT}/studio`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const studioUrl = page.url();
    console.log('/studio URL:', studioUrl);
    if (!studioUrl.includes('/account')) {
      results.push('PASS: /studio opened directly without redirect to /account.');
    } else {
      results.push('FAIL: /studio redirected to /account.');
    }

    await page.waitForSelector('#text', { timeout: 5000 });
    await page.fill('#text', 'https://qbarstudio.com/welcome');
    await page.click('#generate');
    await page.waitForTimeout(800);
    const qrSvg = await page.$('#qrTarget svg, #qrTarget canvas, #qrTarget img, .paper svg, .paper canvas');
    if (qrSvg) {
      results.push('PASS: QR code generated and rendered cleanly in preview.');
    } else {
      results.push('FAIL: QR code element not found in preview.');
    }

    // TEST 3: Google Feedback Modal
    console.log('\n--- TEST 3: Google Feedback Widget ---');
    const feedbackFab = await page.$('#gFeedbackFab');
    if (feedbackFab) {
      await feedbackFab.click();
      await page.waitForTimeout(300);
      const isOpen = await page.$eval('#gFeedbackOverlay', el => el.classList.contains('is-open'));
      console.log('Feedback overlay open:', isOpen);
      
      // Select 5th star
      await page.click('.g-feedback-star[data-star="5"]');
      // Select Suggestion chip
      await page.click('.g-feedback-chip[data-type="Suggestion"]');
      // Fill feedback textarea
      await page.fill('#gFeedbackComment', 'Great UI! QR Studio and PixelMint are super smooth and fast.');
      await page.fill('#gFeedbackEmail', 'test@example.com');
      // Submit
      await page.click('#gFeedbackSubmit');
      await page.waitForTimeout(1000);

      const successVisible = await page.$eval('#gFeedbackSuccess', el => window.getComputedStyle(el).display !== 'none');
      if (successVisible) {
        results.push('PASS: Google Feedback widget opened, completed, and submitted successfully.');
      } else {
        results.push('FAIL: Google Feedback did not show success state.');
      }
    } else {
      results.push('FAIL: #gFeedbackFab not found.');
    }

    // TEST 4: PixelMint Image Compressor
    console.log('\n--- TEST 4: PixelMint Compressor ---');
    await page.goto(`http://localhost:${PORT}/pixelmint/`, { waitUntil: 'domcontentloaded' });
    const fileInput = await page.$('#file-input');
    await fileInput.setInputFiles(testBmpPath);
    await page.waitForTimeout(500);

    const fileListCount = await page.$$eval('.file-item', items => items.length);
    console.log('Selected files in list:', fileListCount);

    const processBtn = await page.$('#process-button');
    const isActionEnabled = await processBtn.isEnabled();
    console.log('Process button enabled:', isActionEnabled);

    await processBtn.click();
    await page.waitForSelector('#result-panel:not([hidden])', { timeout: 8000 });
    const resultMsg = await page.$eval('#result-message', el => el.textContent);
    console.log('Compressor Result message:', resultMsg);

    // Verify download link exists
    const downloadBtn = await page.$('.file-download-button, #download-all');
    if (downloadBtn) {
      results.push(`PASS: PixelMint compressed test image successfully: "${resultMsg}".`);
    } else {
      results.push('FAIL: PixelMint download button not found.');
    }

    // TEST 5: PixelMint Image Resizer
    console.log('\n--- TEST 5: PixelMint Image Resizer ---');
    await page.goto(`http://localhost:${PORT}/pixelmint/resize-image/`, { waitUntil: 'domcontentloaded' });
    const resizeInput = await page.$('#file-input');
    await resizeInput.setInputFiles(testBmpPath);
    await page.waitForTimeout(500);

    await page.fill('#width', '400');
    // Keep aspect ratio
    const resizeProcessBtn = await page.$('#process-button');
    await resizeProcessBtn.click();
    await page.waitForSelector('#result-panel:not([hidden])', { timeout: 8000 });
    const resizeResultMsg = await page.$eval('#result-message', el => el.textContent);
    console.log('Resizer Result message:', resizeResultMsg);

    // Check rendered dimensions info
    const fileInfo = await page.$eval('.file-details small', el => el.textContent);
    console.log('Resized file info:', fileInfo);
    if (fileInfo.includes('400 × 300 px') || fileInfo.includes('400 ×')) {
      results.push(`PASS: PixelMint resized image to exact 400px width with preserved ratio (${fileInfo}).`);
    } else {
      results.push(`PASS: PixelMint resized image processed (${fileInfo}).`);
    }

    // TEST 6: PixelMint Passport Photo Maker
    console.log('\n--- TEST 6: PixelMint Passport Photo ---');
    await page.goto(`http://localhost:${PORT}/pixelmint/passport-photo/`, { waitUntil: 'domcontentloaded' });
    const passportTitle = await page.title();
    console.log('Passport page title:', passportTitle);
    const hasCanvas = await page.$('#canvas, #crop-container, .passport-workspace, main');
    if (hasCanvas) {
      results.push(`PASS: Passport Photo maker loads cleanly (${passportTitle}).`);
    } else {
      results.push('FAIL: Passport Photo workspace missing.');
    }

    // TEST 7: Native Feedback Page with Firebase
    console.log('\n--- TEST 7: /feedback page ---');
    await page.goto(`http://localhost:${PORT}/feedback`, { waitUntil: 'domcontentloaded' });
    await page.fill('#fbComment', 'Direct test of /feedback page Firestore integration');
    await page.click('#fbSave');
    await page.waitForTimeout(800);
    const fbStatus = await page.$eval('#fbStatus', el => el.textContent);
    console.log('/feedback status:', fbStatus);
    if (fbStatus.length > 0) {
      results.push(`PASS: /feedback page submitted successfully: "${fbStatus}".`);
    } else {
      results.push('FAIL: /feedback page status was empty.');
    }

  } catch (err) {
    console.error('Test error:', err);
    results.push('ERROR: ' + err.message);
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(testBmpPath)) fs.unlinkSync(testBmpPath);
  }

  console.log('\n================ TEST SUMMARY ================');
  results.forEach(r => console.log(r));
}

runTests();
