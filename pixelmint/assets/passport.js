(() => {
  const $ = (selector) => document.querySelector(selector);
  const file = $('#passport-file');
  const upload = $('.passport-upload');
  const viewport = $('#crop-viewport');
  const preset = $('#photo-preset');
  const custom = $('#custom-ratio');
  const zoom = $('#zoom');
  const status = $('#passport-status');
  const format = $('#export-format');
  const resolutionNote = $('#resolution-note');
  let source = null;
  let blobOut = null;
  let outputName = '';
  let dims = { w: 7, h: 9 };
  let pan = { x: .5, y: .5 };
  let dragging = false;
  let dragStart = null;
  const makeUrl = URL.createObjectURL;
  const presets = {
    'india-digital': { w: 7, h: 9, outW: 630, outH: 810 },
    'uk-digital': { w: 4, h: 5, outW: 1200, outH: 1500 },
    'uk-print': { w: 7, h: 9, outW: 413, outH: 531 },
    'us-square': { w: 1, h: 1, outW: 1200, outH: 1200 },
    '4x6': { w: 2, h: 3, outW: 800, outH: 1200 }
  };
  const getPreset = () => presets[preset.value] || null;
  const getRatio = () => {
    const selected = getPreset();
    if (selected) return { w: selected.w, h: selected.h };
    if (preset.value === 'custom') return { w: Math.max(1, +$('#ratio-w').value || 7), h: Math.max(1, +$('#ratio-h').value || 9) };
    return { w: 7, h: 9 };
  };
  const exportDimensions = () => {
    if ($('#resolution-mode').value === 'source' && source) {
      const rect = cropRect(), maxEdge = 6000, maxPixels = 16_000_000;
      const scale = Math.min(1, maxEdge / rect.w, maxEdge / rect.h, Math.sqrt(maxPixels / (rect.w * rect.h)));
      return { width: Math.max(1, Math.round(rect.w * scale)), height: Math.max(1, Math.round(rect.h * scale)) };
    }
    const selected = getPreset();
    if (selected) return { width: selected.outW, height: selected.outH };
    const ratio = dims.w / dims.h;
    return ratio >= 1 ? { width: 1200, height: Math.round(1200 / ratio) } : { width: Math.round(1200 * ratio), height: 1200 };
  };
  function cropRect() {
    if (!source) return null;
    const sw = source.naturalWidth, sh = source.naturalHeight, ratio = dims.w / dims.h, scale = zoom.value / 100;
    let width = Math.min(sw, sh * ratio) / scale;
    let height = width / ratio;
    if (height > sh) { height = sh / scale; width = height * ratio; }
    return { x: (sw - width) * pan.x, y: (sh - height) * pan.y, w: width, h: height };
  }
  function updateResolutionNote(rect = cropRect()) {
    if (!source || !rect) { resolutionNote.textContent = 'Upload a photo to check its available crop resolution.'; resolutionNote.removeAttribute('data-soft'); return; }
    const output = exportDimensions(), cropW = Math.max(1, Math.round(rect.w)), cropH = Math.max(1, Math.round(rect.h));
    const upscaling = output.width > cropW || output.height > cropH;
    resolutionNote.textContent = upscaling
      ? `Source crop ${cropW} × ${cropH} px → export ${output.width} × ${output.height} px. Enlarging cannot restore missing detail; the photo may look soft when zoomed.`
      : `Source crop ${cropW} × ${cropH} px → export ${output.width} × ${output.height} px. No upscaling; choose a lossless format to avoid added compression.`;
    resolutionNote.dataset.soft = String(upscaling);
  }
  function update() {
    dims = getRatio();
    custom.hidden = preset.value !== 'custom';
    $('#zoom-value').value = `${(zoom.value / 100).toFixed(1)}×`;
    viewport.style.aspectRatio = `${dims.w}/${dims.h}`;
    if (!source) { updateResolutionNote(null); return; }
    const ratio = dims.w / dims.h, maxHeight = window.innerHeight * .68;
    const frameWidth = Math.min(viewport.parentElement.clientWidth, 620, maxHeight * ratio);
    const frameHeight = frameWidth / ratio, rect = cropRect(), sw = source.naturalWidth, sh = source.naturalHeight;
    viewport.style.width = `${frameWidth}px`;
    viewport.style.height = `${frameHeight}px`;
    source.style.width = `${frameWidth * sw / rect.w}px`;
    source.style.height = `${frameHeight * sh / rect.h}px`;
    source.style.left = `${-rect.x * frameWidth / rect.w}px`;
    source.style.top = `${-rect.y * frameHeight / rect.h}px`;
    updateResolutionNote(rect);
  }
  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }
  function bytesFromText(text) { return new TextEncoder().encode(text); }
  function joinBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0), result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }
  function getRgbPixels(canvas, width, height) {
    const rgba = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);
    for (let input = 0, output = 0; input < rgba.length; input += 4) {
      const alpha = rgba[input + 3] / 255;
      rgb[output++] = Math.round(rgba[input] * alpha + 255 * (1 - alpha));
      rgb[output++] = Math.round(rgba[input + 1] * alpha + 255 * (1 - alpha));
      rgb[output++] = Math.round(rgba[input + 2] * alpha + 255 * (1 - alpha));
    }
    return rgb;
  }
  async function deflateBytes(bytes) {
    if (!('CompressionStream' in window)) return { bytes, compressed: false };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
      return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), compressed: true };
    } catch { return { bytes, compressed: false }; }
  }
  async function encodeSvg(canvas, width, height) {
    const pngUrl = canvas.toDataURL('image/png');
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${pngUrl}"/></svg>`;
    return new Blob([xml], { type: 'image/svg+xml' });
  }
  async function encodePdf(canvas, width, height) {
    const { bytes: imageBytes, compressed } = await deflateBytes(getRgbPixels(canvas, width, height));
    const chunks = [], offsets = [0];
    let length = 0;
    const add = (part) => { const bytes = typeof part === 'string' ? bytesFromText(part) : part; chunks.push(bytes); length += bytes.length; };
    add('%PDF-1.4\n% PixelMint\n');
    const object = (id, parts) => { offsets[id] = length; add(`${id} 0 obj\n`); parts.forEach(add); add('\nendobj\n'); };
    object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    object(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
    object(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
    const imageFilter = compressed ? ' /Filter /FlateDecode' : '';
    object(4, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8${imageFilter} /Length ${imageBytes.length} >>\nstream\n`, imageBytes, '\nendstream']);
    const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`, contentBytes = bytesFromText(content);
    object(5, [`<< /Length ${contentBytes.length} >>\nstream\n`, contentBytes, 'endstream']);
    const xrefOffset = length;
    add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  async function encodeTiff(canvas, width, height) {
    const { bytes: rgb, compressed } = await deflateBytes(getRgbPixels(canvas, width, height));
    const tags = [256,257,258,259,262,273,277,278,279,282,283,296], ifdOffset = 8, ifdEnd = ifdOffset + 2 + tags.length * 12 + 4;
    const bitsOffset = ifdEnd, xResolutionOffset = bitsOffset + 6, yResolutionOffset = xResolutionOffset + 8, stripOffset = yResolutionOffset + 8;
    const bytes = new Uint8Array(stripOffset + rgb.length), view = new DataView(bytes.buffer);
    bytes[0] = 0x49; bytes[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, ifdOffset, true);
    view.setUint16(ifdOffset, tags.length, true);
    const entries = [
      [256,4,1,width],[257,4,1,height],[258,3,3,bitsOffset],[259,3,1,compressed ? 8 : 1],[262,3,1,2],
      [273,4,1,stripOffset],[277,3,1,3],[278,4,1,height],[279,4,1,rgb.length],
      [282,5,1,xResolutionOffset],[283,5,1,yResolutionOffset],[296,3,1,2]
    ];
    entries.forEach(([tag,type,count,value], index) => {
      const offset = ifdOffset + 2 + index * 12;
      view.setUint16(offset, tag, true); view.setUint16(offset + 2, type, true); view.setUint32(offset + 4, count, true);
      if (type === 3 && count === 1) view.setUint16(offset + 8, value, true); else view.setUint32(offset + 8, value, true);
    });
    view.setUint32(ifdOffset + 2 + tags.length * 12, 0, true);
    view.setUint16(bitsOffset, 8, true); view.setUint16(bitsOffset + 2, 8, true); view.setUint16(bitsOffset + 4, 8, true);
    view.setUint32(xResolutionOffset, 300, true); view.setUint32(xResolutionOffset + 4, 1, true);
    view.setUint32(yResolutionOffset, 300, true); view.setUint32(yResolutionOffset + 4, 1, true);
    bytes.set(rgb, stripOffset);
    return new Blob([bytes], { type: 'image/tiff' });
  }
  function extensionFor(type) {
    return ({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/svg+xml':'svg', 'application/pdf':'pdf', 'image/tiff':'tiff' })[type] || 'bin';
  }
  function describeFormat() {
    const explanations = {
      'image/jpeg': 'JPG: broadly compatible and smaller, but re-encoding can soften details slightly.',
      'image/png': 'PNG: lossless after crop; it will not restore detail missing from the original photo.',
      'image/webp': 'WebP: usually smaller than JPG; this high-quality export is still lossy.',
      'image/svg+xml': 'SVG wrapper: contains the cropped raster photo as PNG. It does not turn pixels into vector detail.',
      'application/pdf': 'PDF: places the photo on a page and stores the raster pixels losslessly. It does not add detail.',
      'image/tiff': 'TIFF: lossless RGB pixels with compression when supported. It can still be larger than JPG or WebP.'
    };
    $('#format-help').textContent = explanations[format.value] || '';
  }
  preset.addEventListener('change', () => { pan = { x: .5, y: .5 }; update(); });
  zoom.addEventListener('input', update);
  $('#ratio-w').addEventListener('input', update);
  $('#ratio-h').addEventListener('input', update);
  format.addEventListener('change', describeFormat);
  $('#resolution-mode').addEventListener('change', update);
  window.addEventListener('resize', update);
  file.addEventListener('change', () => {
    const selectedFile = file.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/') || selectedFile.size > 20 * 1024 * 1024) { status.textContent = 'Choose an image under 20 MB.'; file.value = ''; return; }
    if (source) URL.revokeObjectURL(source.src);
    source = new Image(); source.alt = 'Portrait crop preview'; source.id = 'crop-image';
    source.onload = () => { upload.hidden = true; $('#preview-wrap').hidden = false; $('#crop-export').disabled = false; $('#passport-result').hidden = true; status.textContent = ''; pan = { x: .5, y: .5 }; update(); };
    source.onerror = () => { status.textContent = 'This image could not be opened.'; };
    source.src = makeUrl(selectedFile); viewport.replaceChildren(source); file.value = '';
  });
  viewport.addEventListener('pointerdown', (event) => { if (!source) return; dragging = true; dragStart = { x: event.clientX, y: event.clientY, pan: { ...pan } }; viewport.setPointerCapture(event.pointerId); });
  viewport.addEventListener('pointermove', (event) => {
    if (!dragging || !dragStart || !source) return;
    const rect = cropRect(), sw = source.naturalWidth, sh = source.naturalHeight, dx = event.clientX - dragStart.x, dy = event.clientY - dragStart.y;
    pan.x = Math.max(0, Math.min(1, dragStart.pan.x - dx * (rect.w / viewport.clientWidth) / Math.max(1, sw - rect.w)));
    pan.y = Math.max(0, Math.min(1, dragStart.pan.y - dy * (rect.h / viewport.clientHeight) / Math.max(1, sh - rect.h)));
    update();
  });
  viewport.addEventListener('pointerup', () => { dragging = false; dragStart = null; });
  viewport.addEventListener('pointercancel', () => { dragging = false; dragStart = null; });
  $('#crop-export').addEventListener('click', async () => {
    if (!source) return;
    try {
      status.textContent = 'Creating your crop…';
      const rect = cropRect(), { width, height } = exportDimensions(), canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: format.value === 'image/tiff' });
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      if (format.value === 'image/jpeg' || format.value === 'application/pdf') { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
      context.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
      const type = format.value;
      if (type === 'image/svg+xml') blobOut = await encodeSvg(canvas, width, height);
      else if (type === 'application/pdf') blobOut = await encodePdf(canvas, width, height);
      else if (type === 'image/tiff') blobOut = await encodeTiff(canvas, width, height);
      else blobOut = await canvasBlob(canvas, type, .96);
      if (!blobOut) throw new Error('This browser could not export the selected format. Try PNG or JPG.');
      outputName = `passport-crop.${extensionFor(type)}`;
      const formatName = ({ 'image/jpeg':'JPG', 'image/png':'PNG', 'image/webp':'WebP', 'image/svg+xml':'SVG', 'application/pdf':'PDF', 'image/tiff':'TIFF' })[type];
      $('#passport-dimensions').textContent = `${(blobOut.size / 1024).toFixed(0)} KB · ${width} × ${height} px · ${formatName}`;
      $('#passport-result').hidden = false;
      status.textContent = 'Crop is ready. Download it or continue in another tool.';
    } catch (error) { status.textContent = error.message || 'Could not export this format in your browser.'; }
  });
  $('#passport-download').addEventListener('click', () => {
    if (!blobOut) return;
    const anchor = document.createElement('a'); anchor.href = makeUrl(blobOut); anchor.download = outputName; anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 30000);
  });
  async function handoff(target) {
    if (!blobOut || !target) return;
    try {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('pixelmint-local-workflow', 1); request.onupgradeneeded = () => request.result.createObjectStore('transfers'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const id = crypto.randomUUID();
      await new Promise((resolve, reject) => { const tx = db.transaction('transfers', 'readwrite'); tx.objectStore('transfers').put([{ blob: blobOut, name: outputName }], id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      location.href = `${target}?import=${id}`;
    } catch { status.textContent = 'Could not pass the crop. Download it and choose it in the next tool.'; }
  }
  $('#passport-next').addEventListener('change', (event) => handoff(event.target.value));
  const transferId = new URLSearchParams(location.search).get('import');
  if (transferId) (async () => {
    try {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('pixelmint-local-workflow', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const items = await new Promise((resolve, reject) => { const tx = db.transaction('transfers', 'readwrite'), store = tx.objectStore('transfers'), request = store.get(transferId); request.onsuccess = () => { store.delete(transferId); resolve(request.result || []); }; request.onerror = () => reject(request.error); });
      if (items[0]) { const imported = new File([items[0].blob], items[0].name, { type: items[0].blob.type }), transfer = new DataTransfer(); transfer.items.add(imported); file.files = transfer.files; file.dispatchEvent(new Event('change')); }
      history.replaceState({}, '', location.pathname);
    } catch { status.textContent = 'Could not import image; choose it from your device.'; }
  })();
  describeFormat();
  $('#year').textContent = new Date().getFullYear();
})();
