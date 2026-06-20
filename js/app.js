// Infinite Timeline — app logic
// In-memory events array; no persistence, no backend

let events = [];
let timelineEl = null;

// ── Render ────────────────────────────────────────────────────────────────────

function renderTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<div class="timeline-empty">Add events above or import a file to see the timeline.</div>';
    timelineEl = null;
    return;
  }

  // If an existing timeline component is in the DOM, update it in place (preserves zoom)
  const existing = container.querySelector('.timeline-component');
  if (existing && existing.updateEvents) {
    existing.updateEvents(events);
    return;
  }

  container.innerHTML = '';
  timelineEl = window.Timeline({
    width: '100%',
    height: '340',
    events,
    parentElement: container
  });
  container.appendChild(timelineEl);

  // Move the zoom controls out of the fixed-height SVG box so they don't overlap content
  const controlsWrapper = timelineEl.querySelector('.timeline-controls')?.parentElement;
  if (controlsWrapper && controlsWrapper.parentElement === timelineEl) {
    timelineEl.removeChild(controlsWrapper);
    container.appendChild(controlsWrapper);
  }
}

// ── Event list ────────────────────────────────────────────────────────────────

function renderEventList() {
  const list = document.getElementById('event-list');
  if (!list) return;

  if (events.length === 0) {
    list.innerHTML = '<p class="event-list-empty">No events yet.</p>';
    return;
  }

  const sorted = events.slice().sort((a, b) => {
    const ya = a.is_bc ? -a.year : a.year;
    const yb = b.is_bc ? -b.year : b.year;
    if (ya !== yb) return ya - yb;
    return (a.month || 0) - (b.month || 0);
  });

  list.innerHTML = '';
  sorted.forEach((ev, sortedIdx) => {
    const originalIdx = events.indexOf(ev);
    const row = document.createElement('div');
    row.className = 'event-row';

    const dateStr = formatDate(ev);
    const info = document.createElement('span');
    info.className = 'event-info';
    info.textContent = `${ev.name} — ${dateStr}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove event';
    removeBtn.addEventListener('click', () => {
      events.splice(originalIdx, 1);
      renderEventList();
      renderTimeline();
    });

    row.appendChild(info);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function formatDate(ev) {
  const year = ev.is_bc ? `${ev.year} BC` : String(ev.year).padStart(4, '0');
  const month = ev.month ? `-${String(ev.month).padStart(2, '0')}` : '';
  const day = ev.day ? `-${String(ev.day).padStart(2, '0')}` : '';
  return `${year}${month}${day}`;
}

// ── Form ──────────────────────────────────────────────────────────────────────

function initForm() {
  const form = document.getElementById('event-form');
  if (!form) return;

  // Auto-split pasted YYYYMMDD or YYYY-MM-DD into year/month/day fields
  const yearInput = form.querySelector('#field-year');
  yearInput.addEventListener('input', () => {
    const raw = yearInput.value.replace(/\s+/g, '');
    let m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) m = raw.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
    if (!m) return;
    const [, y, mo, d] = m;
    if (parseInt(mo) < 1 || parseInt(mo) > 12) return;
    if (parseInt(d) < 1 || parseInt(d) > 31) return;
    yearInput.value = y;
    form.querySelector('#field-month').value = parseInt(mo);
    form.querySelector('#field-day').value = parseInt(d);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.querySelector('#field-name').value.trim();
    const year = parseInt(form.querySelector('#field-year').value, 10);
    const month = parseInt(form.querySelector('#field-month').value, 10) || null;
    const day = parseInt(form.querySelector('#field-day').value, 10) || null;
    const is_bc = form.querySelector('#field-bc').value === 'true';

    if (!name) { showError('Event name is required.'); return; }
    if (!year || isNaN(year) || year < 1) { showError('A valid year (≥ 1) is required.'); return; }
    if (day && (day < 1 || day > 31)) { showError('Day must be between 1 and 31.'); return; }

    events.push({ name, year, month, day, is_bc });
    form.reset();
    renderEventList();
    renderTimeline();
  });
}

// ── Import ────────────────────────────────────────────────────────────────────

function initImport() {
  const backdrop = document.getElementById('csv-dialog-backdrop');

  const openDialog = () => { backdrop.style.display = 'flex'; };
  const closeDialog = () => { backdrop.style.display = 'none'; };

  document.getElementById('import-csv-btn').addEventListener('click', openDialog);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeDialog(); });

  document.getElementById('csv-dialog-cancel').addEventListener('click', closeDialog);

  document.getElementById('csv-dialog-template').addEventListener('click', () => {
    const template = [
      'name,year,month,day,is_bc',
      '"Moon Landing",1969,7,20,false',
      '"Battle of Hastings",1066,10,,false',
      '"Julius Caesar born",100,,,true'
    ].join('\n');
    downloadText(template, 'timeline-template.csv', 'text/csv');
  });

  document.getElementById('csv-dialog-import').addEventListener('click', () => {
    closeDialog();
    pickFile('.csv,text/csv', file => {
      const reader = new FileReader();
      reader.onload = e => {
        const imported = parseCSV(e.target.result);
        if (imported.length === 0) { showError('No valid events found in CSV.'); return; }
        events.push(...imported);
        renderEventList();
        renderTimeline();
        showStatus(`Imported ${imported.length} event(s) from CSV.`);
      };
      reader.readAsText(file);
    });
  });
}

function pickFile(accept, callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => { if (input.files[0]) callback(input.files[0]); });
  input.click();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('year');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Determine column order from header or assume: name, year, month, day, is_bc
  let colName = 0, colYear = 1, colMonth = 2, colDay = 3, colBC = 4;
  if (hasHeader) {
    const cols = splitCSVRow(lines[0]).map(h => h.toLowerCase().trim());
    colName = cols.indexOf('name');
    colYear = cols.indexOf('year');
    colMonth = cols.indexOf('month');
    colDay = cols.indexOf('day');
    colBC = cols.findIndex(c => c === 'is_bc' || c === 'bc');
    if (colName === -1) colName = 0;
    if (colYear === -1) colYear = 1;
  }

  return dataLines.map(line => {
    const cols = splitCSVRow(line);
    const name = (cols[colName] || '').trim().replace(/^"|"$/g, '');
    const rawYear = (cols[colYear] || '').trim().replace(/^"|"$/g, '');
    const year = Math.abs(parseInt(rawYear, 10));
    if (!name || !year) return null;
    return {
      name,
      year,
      month: colMonth >= 0 && cols[colMonth] ? parseInt(cols[colMonth]) || null : null,
      day: colDay >= 0 && cols[colDay] ? parseInt(cols[colDay]) || null : null,
      is_bc: colBC >= 0 && cols[colBC] ? ['true', '1', 'yes', 'bc'].includes((cols[colBC] || '').trim().toLowerCase()) : false
    };
  }).filter(Boolean);
}

function splitCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '"') {
      if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (row[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += row[i];
    }
  }
  result.push(current);
  return result;
}

// ── Export ────────────────────────────────────────────────────────────────────

function initExport() {
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    if (events.length === 0) { showError('No events to export.'); return; }
    const header = 'name,year,month,day,is_bc';
    const rows = events.map(ev =>
      [
        `"${ev.name.replace(/"/g, '""')}"`,
        ev.year,
        ev.month || '',
        ev.day || '',
        ev.is_bc ? 'true' : 'false'
      ].join(',')
    );
    downloadText([header, ...rows].join('\n'), 'timeline-events.csv', 'text/csv');
  });

  document.getElementById('export-png-btn').addEventListener('click', () => {
    const svgEl = document.querySelector('#timeline-container svg');
    if (!svgEl) { showError('No timeline to export. Add events first.'); return; }
    exportSVGasPNG(svgEl);
  });
}

function downloadText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSVGasPNG(svgEl) {
  const svgClone = svgEl.cloneNode(true);

  // Inline CSS variable values for standalone export
  const computedStyle = getComputedStyle(document.documentElement);
  const vars = {
    '--color-dark': computedStyle.getPropertyValue('--color-dark').trim() || '#1a1a2e',
    '--color-accent': computedStyle.getPropertyValue('--color-accent').trim() || '#6c63ff',
    '--color-accent-border': computedStyle.getPropertyValue('--color-accent-border').trim() || '#a89bff',
    '--color-gray': computedStyle.getPropertyValue('--color-gray').trim() || '#ccc',
    '--color-muted': computedStyle.getPropertyValue('--color-muted').trim() || '#888',
    '--font-body': 'Arial, sans-serif'
  };

  // Add a white background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', svgClone.getAttribute('width'));
  bg.setAttribute('height', svgClone.getAttribute('height'));
  bg.setAttribute('fill', '#ffffff');
  svgClone.insertBefore(bg, svgClone.firstChild);

  // Replace CSS vars in attribute values
  const replaceVars = (el) => {
    Array.from(el.attributes).forEach(attr => {
      let val = attr.value;
      Object.entries(vars).forEach(([k, v]) => {
        val = val.replaceAll(`var(${k})`, v);
      });
      el.setAttribute(attr.name, val);
    });
    Array.from(el.children).forEach(replaceVars);
  };
  replaceVars(svgClone);

  const svgStr = new XMLSerializer().serializeToString(svgClone);
  // Use a data URL instead of a blob URL — more reliable across browsers and file:// protocol
  const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

  const img = new Image();
  img.onload = () => {
    const w = parseInt(svgEl.getAttribute('width'), 10) || 800;
    const h = parseInt(svgEl.getAttribute('height'), 10) || 400;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const pngDataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngDataUrl;
    a.download = 'timeline.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  img.onerror = () => showError('PNG export failed. Try a different browser.');
  img.src = svgDataUrl;
}

// ── Clear all ─────────────────────────────────────────────────────────────────

function initClearAll() {
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (events.length === 0) return;
    if (!confirm('Remove all events?')) return;
    events.length = 0;
    renderEventList();
    renderTimeline();
  });
}

// ── Status / Error messages ───────────────────────────────────────────────────

function showStatus(msg) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg status-ok';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 4000);
}

function showError(msg) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg status-err';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 5000);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initForm();
  initImport();
  initExport();
  initClearAll();
  renderEventList();
  renderTimeline();
});
