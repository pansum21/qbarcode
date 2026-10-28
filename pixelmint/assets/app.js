(async () => {
  const $ = (selector) => document.querySelector(selector);
  const mode = document.body.dataset.mode || 'compress';
  const input = $('#file-input');
  const dropzone = $('#dropzone');
  const filesEl = $('#file-list');
  const uploadFooter = $('#upload-footer');
  const fileCount = $('#file-count');
  const browseButton = $('#browse-button');
  const browseMore = $('#browse-more');
  const selectFirst = $('#select-first');
  const action = $('#process-button');
  const actionLabel = $('#process-label');
  const status = $('#status-message');
  const resultPanel = $('#result-panel');
  const state = { files: [], busy: false };
  const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const safeBase = (name) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || 'image';
  const setYear = $('#year');
  if (setYear) setYear.textContent = new Date().getFullYear();

  const titles = {
    compress: ['Compression settings', 'Find a smaller file size while keeping your image crisp.'],
    convert: ['Conversion settings', 'Choose the format you need for sharing, publishing, or storage.'],
    resize: ['Resize settings', 'Set exact dimensions and keep your image proportions.']
  };
  if ($('#settings-title')) $('#settings-title').textContent = titles[mode][0];
  if ($('#settings-description')) $('#settings-description').textContent = titles[mode][1];
  if ($('#resize-setting')) $('#resize-setting').hidden = mode !== 'resize';
  if ($('#quality-setting')) $('#quality-setting').hidden = false;
  if ($('#target-setting')) $('#target-setting').hidden = mode === 'resize';
  if ((mode === 'compress' || mode === 'convert') && $('#format')) $('#format').value = 'image/webp';
  if (mode === 'resize' && $('#quality')) $('#quality').value = '88';

  const updateAction = () => {
    if (!action) return;
    action.hidden = state.files.length === 0;
    if (selectFirst) selectFirst.hidden = state.files.length > 0;
    action.disabled = !state.files.length || state.busy;
    actionLabel.textContent = state.busy ? 'Processing images…' : `Process ${state.files.length} image${state.files.length === 1 ? '' : 's'}`;
  };

  const updateDownloadAction = () => {
    const button = $('#download-all');
    if (!button) return;
    const outputs = state.files.filter(entry => entry.output);
    const selectedCount = outputs.filter(entry => entry.selected !== false).length;
    button.hidden = outputs.length < 2;
    button.disabled = selectedCount === 0 || state.busy;
    button.innerHTML = selectedCount === outputs.length
      ? `Download all ${outputs.length} files <span aria-hidden="true">↓</span>`
      : selectedCount
        ? `Download ${selectedCount} files <span aria-hidden="true">↓</span>`
        : 'Select files to download';
  };

  const getDimensions = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be opened by your browser.')); };
    image.src = url;
  });

  const renderFiles = () => {
    if (!filesEl) return;
    dropzone?.classList.toggle('has-files', state.files.length > 0);
    if (uploadFooter) uploadFooter.hidden = state.files.length === 0;
    if (fileCount) {
      const total = state.files.reduce((sum, entry) => sum + entry.file.size, 0);
      fileCount.textContent = state.files.length
        ? `${state.files.length} image${state.files.length === 1 ? '' : 's'} selected · ${fmtBytes(total)} total`
        : '';
    }
    filesEl.replaceChildren();
    const singleFile = state.files.length === 1;
    const multipleOutputs = state.files.filter(entry => entry.output).length > 1;
    filesEl.classList.toggle('single-file-list', singleFile);
    state.files.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = `file-item${singleFile ? ' single-file-item' : ''}`;
      row.setAttribute('role', 'listitem');
      const thumb = document.createElement('img');
      thumb.className = 'file-thumb'; thumb.alt = ''; thumb.src = entry.previewUrl;
      const previewFrame = document.createElement('div');
      previewFrame.className = 'file-preview-frame';
      if (entry.dimensions?.width && entry.dimensions?.height) {
        previewFrame.style.aspectRatio = `${entry.dimensions.width} / ${entry.dimensions.height}`;
      }
      previewFrame.append(thumb);
      const details = document.createElement('span'); details.className = 'file-details';
      const name = document.createElement('strong'); name.textContent = entry.file.name;
      const info = document.createElement('small');
      info.textContent = entry.output
        ? `Original ${fmtBytes(entry.file.size)} · ${entry.dimensions.width} × ${entry.dimensions.height} px → Output ${fmtBytes(entry.output.size)} · ${entry.outputDimensions.width} × ${entry.outputDimensions.height} px${entry.outputUnchanged ? ' · original kept because this format could not make it smaller' : ''}`
        : `${fmtBytes(entry.file.size)} · ${entry.dimensions ? `${entry.dimensions.width} × ${entry.dimensions.height} px` : ''}${entry.error ? ` · ${entry.error}` : ''}`;
      details.append(name, info);
      const actions = document.createElement('span'); actions.className = 'file-actions';
      if (entry.output && multipleOutputs) {
        const label = document.createElement('label'); label.className = 'file-select-label';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'file-select';
        checkbox.checked = entry.selected !== false;
        checkbox.setAttribute('aria-label', `Select ${entry.outputName} for download`);
        checkbox.addEventListener('change', () => { entry.selected = checkbox.checked; updateDownloadAction(); });
        const labelText = document.createElement('span'); labelText.textContent = 'Select';
        label.append(checkbox, labelText); actions.append(label);
      } else {
        const button = document.createElement('button'); button.type = 'button'; button.className = entry.output ? 'file-download' : 'file-remove';
        button.setAttribute('aria-label', entry.output ? `Download ${entry.outputName}` : `Remove ${entry.file.name}`);
        button.textContent = entry.output ? 'Download' : '×';
        button.addEventListener('click', () => entry.output ? download(entry.output, entry.outputName) : removeFile(index));
        actions.append(button);
      }
      if (entry.output) {
        const next = document.createElement('select'); next.className = 'continue-select'; next.setAttribute('aria-label', `Continue ${entry.outputName} in another tool`);
        next.innerHTML = `<option value="">Continue in…</option><option value="/pixelmint/">Compress</option><option value="/pixelmint/convert-image/">Convert</option><option value="/pixelmint/resize-image/">Resize</option><option value="/pixelmint/passport-photo/">Passport photo</option>`;
        next.addEventListener('change', async () => { if (next.value) await handoff([{ blob: entry.output, name: entry.outputName }], next.value); });
        actions.append(next);
      }
      row.append(previewFrame, details, actions); filesEl.append(row);
      if (singleFile && entry.dimensions?.width && entry.dimensions?.height) {
        const ratio = entry.dimensions.width / entry.dimensions.height;
        const maxHeight = Math.max(220, window.innerHeight * 0.62);
        const frameWidth = Math.min(Math.max(120, row.clientWidth - 26), maxHeight * ratio);
        previewFrame.style.width = `${frameWidth}px`;
        previewFrame.style.height = `${frameWidth / ratio}px`;
      }
    });
    updateDownloadAction();
    updateAction();
  };

  browseButton?.addEventListener('click', () => input?.click());
  browseMore?.addEventListener('click', () => input?.click());

  const removeFile = (index) => {
    const [removed] = state.files.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    resultPanel.hidden = true;
    status.textContent = '';
    renderFiles();
  };

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(file => file.type.startsWith('image/'));
    const skipped = (fileList?.length || 0) - incoming.length;
    const tooLarge = incoming.filter(file => file.size > 20 * 1024 * 1024);
    const accepted = incoming.filter(file => file.size <= 20 * 1024 * 1024);
    if (skipped || tooLarge.length) {
      status.textContent = `${skipped ? `${skipped} non-image file${skipped === 1 ? '' : 's'} skipped. ` : ''}${tooLarge.length ? `${tooLarge.length} file${tooLarge.length === 1 ? '' : 's'} over 20 MB skipped.` : ''}`.trim();
    } else status.textContent = '';
    const unique = accepted.filter(file => !state.files.some(entry => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified));
    for (const file of unique) {
      const entry = { file, previewUrl: URL.createObjectURL(file), dimensions: null, output: null, outputName: '', error: '' };
      state.files.push(entry);
      try { entry.dimensions = await getDimensions(file); } catch (error) { entry.error = error.message; }
    }
    resultPanel.hidden = true;
    renderFiles();
    if (!state.files.length && fileList?.length) status.textContent ||= 'Choose a supported image file under 20 MB.';
  };

  if (input) input.addEventListener('change', (event) => { addFiles(event.target.files); input.value = ''; });
  if (dropzone) {
    dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('dragover'); addFiles(event.dataTransfer.files); });
    dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input?.click(); } });
  }

  const qualitySlider = $('#quality');
  const qualityOutput = $('#quality-output');
  if (qualitySlider && qualityOutput) qualitySlider.addEventListener('input', () => qualityOutput.value = `${qualitySlider.value}%`);

  const updateFormatSettings = () => {
    const format = $('#format')?.value || 'keep';
    const adjustableQuality = ['image/jpeg', 'image/webp'].includes(format) || (mode === 'compress' && format === 'keep');
    if (qualitySlider?.closest('#quality-setting')) qualitySlider.closest('#quality-setting').hidden = !adjustableQuality;
    const target = $('#target-setting');
    if (target) target.hidden = mode === 'resize' || (mode === 'convert' && !['image/jpeg', 'image/webp'].includes(format));
    const help = $('#format-help');
    if (help) {
      help.textContent = format === 'image/svg+xml'
        ? 'SVG contains the raster image; it does not turn pixels into vector detail.'
        : format === 'application/pdf'
          ? 'PDF keeps the same raster pixels on a printable page; it cannot add image detail.'
          : format === 'image/tiff'
            ? 'TIFF preserves raster pixels losslessly; the file can be larger than JPG or WebP.'
            : format === 'image/png'
              ? 'PNG preserves raster detail and transparency. The quality slider applies to JPG and WebP.'
              : '';
    }
  };
  $('#format')?.addEventListener('change', updateFormatSettings);
  updateFormatSettings();

  const maxCanvasSide = 10000;
  const getTargetSize = (entry) => {
    if (mode !== 'resize' || !entry.dimensions) return { width: entry.dimensions.width, height: entry.dimensions.height };
    const widthField = $('#width'); const heightField = $('#height');
    const w = Math.max(0, parseInt(widthField?.value || '0', 10));
    const h = Math.max(0, parseInt(heightField?.value || '0', 10));
    if (!w && !h) return { width: entry.dimensions.width, height: entry.dimensions.height };
    if ($('#keep-ratio')?.checked) {
      const ratio = entry.dimensions.width / entry.dimensions.height;
      if (w && h) { const scale = Math.min(w / entry.dimensions.width, h / entry.dimensions.height); return { width: Math.max(1, Math.round(entry.dimensions.width * scale)), height: Math.max(1, Math.round(entry.dimensions.height * scale)) }; }
      if (w) return { width: w, height: Math.max(1, Math.round(w / ratio)) };
      return { width: Math.max(1, Math.round(h * ratio)), height: h };
    }
    return { width: w || entry.dimensions.width, height: h || entry.dimensions.height };
  };

  const decode = (file) => new Promise((resolve, reject) => {
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode this image format.')); };
    image.src = url;
  });

  const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Your browser does not support this output format.')), type, quality); }
    catch { reject(new Error('This image could not be exported. Try a different output format.')); }
  });

  const bytesFromText = (text) => new TextEncoder().encode(text);
  const joinBytes = (chunks) => {
    const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  };
  const base64DataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not prepare the SVG image.'));
    reader.readAsDataURL(blob);
  });
  const encodeSvg = async (canvas, width, height) => {
    const png = await canvasBlob(canvas, 'image/png');
    const dataUrl = await base64DataUrl(png);
    return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${dataUrl}"/></svg>`], { type: 'image/svg+xml' });
  };
  const deflateBytes = async (bytes) => {
    if (!('CompressionStream' in window)) return { bytes, compressed: false };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
      return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), compressed: true };
    } catch { return { bytes, compressed: false }; }
  };
  const getRgbPixels = (canvas, width, height) => {
    const rgba = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);
    for (let input = 0, output = 0; input < rgba.length; input += 4) {
      const alpha = rgba[input + 3] / 255;
      rgb[output++] = Math.round(rgba[input] * alpha + 255 * (1 - alpha));
      rgb[output++] = Math.round(rgba[input + 1] * alpha + 255 * (1 - alpha));
      rgb[output++] = Math.round(rgba[input + 2] * alpha + 255 * (1 - alpha));
    }
    return rgb;
  };
  const encodePdf = async (canvas, width, height) => {
    const { bytes: imageBytes, compressed } = await deflateBytes(getRgbPixels(canvas, width, height));
    const chunks = [], offsets = [0]; let length = 0;
    const add = (part) => { const bytes = typeof part === 'string' ? bytesFromText(part) : part; chunks.push(bytes); length += bytes.length; };
    const object = (id, parts) => { offsets[id] = length; add(`${id} 0 obj\n`); parts.forEach(add); add('\nendobj\n'); };
    add('%PDF-1.4\n% PixelMint\n');
    object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    object(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
    object(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
    object(4, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8${compressed ? ' /Filter /FlateDecode' : ''} /Length ${imageBytes.length} >>\nstream\n`, imageBytes, '\nendstream']);
    const content = bytesFromText(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`);
    object(5, [`<< /Length ${content.length} >>\nstream\n`, content, 'endstream']);
    const xrefOffset = length;
    add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  };
  const encodeTiff = async (canvas, width, height) => {
    const { bytes: imageBytes, compressed } = await deflateBytes(getRgbPixels(canvas, width, height));
    const tags = [256,257,258,259,262,273,277,278,279,282,283,296], ifdOffset = 8;
    const ifdEnd = ifdOffset + 2 + tags.length * 12 + 4, bitsOffset = ifdEnd;
    const xResolutionOffset = bitsOffset + 6, yResolutionOffset = xResolutionOffset + 8, stripOffset = yResolutionOffset + 8;
    const bytes = new Uint8Array(stripOffset + imageBytes.length), view = new DataView(bytes.buffer);
    bytes[0] = 0x49; bytes[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, ifdOffset, true); view.setUint16(ifdOffset, tags.length, true);
    const entries = [[256,4,1,width],[257,4,1,height],[258,3,3,bitsOffset],[259,3,1,compressed ? 8 : 1],[262,3,1,2],[273,4,1,stripOffset],[277,3,1,3],[278,4,1,height],[279,4,1,rgb.length],[282,5,1,xResolutionOffset],[283,5,1,yResolutionOffset],[296,3,1,2]];
    entries.forEach(([tag,type,count,value], index) => {
      const offset = ifdOffset + 2 + index * 12;
      view.setUint16(offset, tag, true); view.setUint16(offset + 2, type, true); view.setUint32(offset + 4, count, true);
      if (type === 3 && count === 1) view.setUint16(offset + 8, value, true); else view.setUint32(offset + 8, value, true);
    });
    view.setUint32(ifdOffset + 2 + tags.length * 12, 0, true);
    view.setUint16(bitsOffset, 8, true); view.setUint16(bitsOffset + 2, 8, true); view.setUint16(bitsOffset + 4, 8, true);
    view.setUint32(xResolutionOffset, 300, true); view.setUint32(xResolutionOffset + 4, 1, true);
    view.setUint32(yResolutionOffset, 300, true); view.setUint32(yResolutionOffset + 4, 1, true);
    bytes.set(imageBytes, stripOffset);
    return new Blob([bytes], { type: 'image/tiff' });
  };
  const extensionFor = (type) => ({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/svg+xml':'svg', 'application/pdf':'pdf', 'image/tiff':'tiff' })[type] || 'bin';

  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const makeZip = async (entries) => {
    const encoder = new TextEncoder();
    const localParts = [], centralParts = [];
    if (entries.length > 65535) throw new Error('Too many files for one ZIP. Download them individually.');
    let offset = 0;
    const usedNames = new Set();
    for (const [index, entry] of entries.entries()) {
      let outputName = entry.outputName;
      if (usedNames.has(outputName)) {
        const dot = outputName.lastIndexOf('.');
        const stem = dot > 0 ? outputName.slice(0, dot) : outputName;
        const ext = dot > 0 ? outputName.slice(dot) : '';
        outputName = `${stem}-${index + 1}${ext}`;
        while (usedNames.has(outputName)) outputName = `${stem}-${index + 1}-${usedNames.size}${ext}`;
      }
      usedNames.add(outputName);
      const name = encoder.encode(outputName);
      const data = new Uint8Array(await entry.output.arrayBuffer());
      if (name.length > 65535 || data.length > 0xffffffff || offset + data.length > 0xffffffff) throw new Error('These files are too large for one ZIP. Download them individually.');
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
      localView.setUint16(12, 0, true); localView.setUint16(14, 0x21, true);
      localView.setUint32(14, crc, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, name.length, true);
      local.set(name, 30); localParts.push(local, data);
      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true); centralView.setUint16(12, 0x21, true);
      centralView.setUint32(16, crc, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, offset, true); central.set(name, 46); centralParts.push(central);
      offset += local.length + data.length;
    }
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22); const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  };

  const chooseType = (file) => {
    const chosen = $('#format')?.value || 'keep';
    if (chosen !== 'keep') return chosen;
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file.type;
    return 'image/jpeg';
  };

  const encodeImage = async (entry) => {
    if (!entry.dimensions) throw new Error('This image could not be read. Remove it and try another file.');
    let { width, height } = getTargetSize(entry);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error('Enter valid image dimensions.');
    if (width > maxCanvasSide || height > maxCanvasSide || width * height > 60_000_000) throw new Error('Requested image is too large. Use dimensions under 10,000 px and 60 MP.');
    const image = await decode(entry.file);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas processing is unavailable in this browser.');
    const mime = chooseType(entry.file);
    if (mime === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, width, height);
    const baseQuality = Math.max(0.2, Math.min(1, Number(qualitySlider?.value || 82) / 100));
    const targetApplies = mode !== 'resize' && (mode !== 'convert' || ['image/jpeg', 'image/webp'].includes(mime));
    const targetKB = targetApplies ? Math.max(0, Number($('#target-kb')?.value || 0)) : 0;
    if ((mime === 'application/pdf' || mime === 'image/tiff') && width * height > 20_000_000) {
      throw new Error('PDF and TIFF exports are limited to 20 MP to avoid exhausting browser memory. Resize the image first.');
    }
    let blob;
    if (mime === 'image/svg+xml') blob = await encodeSvg(canvas, width, height);
    else if (mime === 'application/pdf') blob = await encodePdf(canvas, width, height);
    else if (mime === 'image/tiff') blob = await encodeTiff(canvas, width, height);
    else blob = await canvasBlob(canvas, mime, baseQuality);
    if (['image/jpeg', 'image/png', 'image/webp'].includes(mime) && blob.type && blob.type !== mime) {
      throw new Error(`This browser cannot create ${mime.replace('image/', '').toUpperCase()} files. Choose a supported output format.`);
    }
    if (targetKB && (mime === 'image/jpeg' || mime === 'image/webp') && blob.size > targetKB * 1024) {
      let low = 0.08, high = baseQuality, best = null;
      for (let i = 0; i < 9; i++) {
        const q = (low + high) / 2;
        const attempt = await canvasBlob(canvas, mime, q);
        if (attempt.size <= targetKB * 1024) { best = attempt; low = q; } else high = q;
      }
      if (best) blob = best;
      else throw new Error(`Could not reach ${targetKB} KB at these dimensions. Resize smaller or choose a higher limit.`);
    } else if (targetKB && blob.size > targetKB * 1024) {
      throw new Error(`This format cannot reach ${targetKB} KB with quality settings. Try WebP or JPG.`);
    }
    // If the chosen quality still produces a larger file, step quality down
    // until compression actually reduces the file. Never label the original
    // as a compressed result without telling the user.
    if (mode === 'compress' && !targetKB && blob.size >= entry.file.size) {
      if (mime === 'image/jpeg' || mime === 'image/webp') {
        for (const quality of [baseQuality * .82, baseQuality * .65, .45, .3, .2]) {
          const attempt = await canvasBlob(canvas, mime, Math.max(.2, quality));
          if (attempt.size < entry.file.size) { blob = attempt; break; }
        }
      }
      if (blob.size >= entry.file.size) return { blob: entry.file, name: entry.file.name, unchanged: true };
    }
    const ext = extensionFor(mime);
    return { blob, name: `${safeBase(entry.file.name)}.${ext}` };
  };

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  if (action) action.addEventListener('click', async () => {
    if (state.busy || !state.files.length) return;
    const width = Number($('#width')?.value || 0); const height = Number($('#height')?.value || 0);
    if (mode === 'resize' && !width && !height) { status.textContent = 'Enter a width or height, or choose a preset.'; return; }
    if (mode === 'resize' && (width > maxCanvasSide || height > maxCanvasSide)) { status.textContent = 'Use dimensions of 10,000 pixels or less.'; return; }
    state.busy = true; status.textContent = ''; resultPanel.hidden = true; updateAction(); renderFiles();
    let completed = 0; let failed = 0; let saved = 0; let originals = 0;
    state.files.forEach(entry => { originals += entry.file.size; });
    for (const entry of state.files) {
      entry.output = null; entry.error = '';
      try {
        const output = await encodeImage(entry);
        entry.output = output.blob; entry.outputName = output.name; entry.outputDimensions = getTargetSize(entry); entry.outputUnchanged = Boolean(output.unchanged); entry.selected = true; completed++; saved += output.blob.size;
      } catch (error) { entry.error = error.message || 'Could not process this file.'; failed++; }
      renderFiles();
    }
    state.busy = false; updateAction(); renderFiles();
    if (completed) {
      $('#result-title').textContent = `${completed} image${completed === 1 ? '' : 's'} ready to download`;
      const unchanged = state.files.filter(entry => entry.outputUnchanged).length;
      $('#result-message').textContent = `${fmtBytes(originals)} original → ${fmtBytes(saved)} output${unchanged ? ` · ${unchanged} already-optimized image${unchanged === 1 ? '' : 's'} kept unchanged` : ''}${failed ? ` · ${failed} could not be processed` : ''}. Each file shows its pixel dimensions.`;
      updateDownloadAction();
      resultPanel.hidden = false;
      status.textContent = failed ? 'Some files need attention; their reason is shown beside each file.' : '';
    } else status.textContent = 'No images could be processed. Check the message beside each file and try again.';
  });

  $('#download-all')?.addEventListener('click', async () => {
    const selected = state.files.filter(entry => entry.output && entry.selected !== false);
    if (!selected.length) return;
    if (selected.length === 1) return download(selected[0].output, selected[0].outputName);
    const button = $('#download-all'); button.disabled = true; button.textContent = 'Preparing ZIP…';
    try { download(await makeZip(selected), `pixelmint-${selected.length}-images.zip`); }
    catch (error) { status.textContent = error.message || 'Could not prepare the ZIP. Download each file individually.'; }
    updateDownloadAction();
  });

  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const width = $('#width'); const height = $('#height'); const preset = button.dataset.preset;
    if (preset === 'social') { width.value = '1080'; height.value = '1080'; if ($('#keep-ratio')) $('#keep-ratio').checked = true; }
    if (preset === 'web') { width.value = '1600'; height.value = ''; if ($('#keep-ratio')) $('#keep-ratio').checked = true; }
    if (preset === 'custom') { width.focus(); }
  }));

  const handoff = async (items, target) => {
    try {
      const db = await new Promise((resolve, reject) => { const req = indexedDB.open('pixelmint-local-workflow', 1); req.onupgradeneeded = () => req.result.createObjectStore('transfers'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
      const id = crypto.randomUUID(); await new Promise((resolve, reject) => { const tx = db.transaction('transfers', 'readwrite'); tx.objectStore('transfers').put(items, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      location.href = `${target}?import=${encodeURIComponent(id)}`;
    } catch { status.textContent = 'Could not pass the image to the next tool. Download it and select it there instead.'; }
  };
  const transferId = new URLSearchParams(location.search).get('import');
  if (transferId && input) {
    try {
      const db = await new Promise((resolve, reject) => { const req = indexedDB.open('pixelmint-local-workflow', 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
      const items = await new Promise((resolve, reject) => { const tx = db.transaction('transfers', 'readwrite'); const store = tx.objectStore('transfers'); const req = store.get(transferId); req.onsuccess = () => { const value = req.result || []; store.delete(transferId); resolve(value); }; req.onerror = () => reject(req.error); });
      await addFiles(items.map((item, i) => new File([item.blob], item.name || `image-${i + 1}.webp`, { type: item.blob.type })));
      history.replaceState({}, '', location.pathname);
    } catch { status.textContent = 'Could not import the image. Please choose it from your device.'; }
  }

  updateAction();
})();
