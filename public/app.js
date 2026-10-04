let companyChart, statusChart, monthChart;
let currentBids = [];
const sortState = { key: 'sent_date', direction: 'desc' };

async function loadAll() {
  const [bids, kpis] = await Promise.all([
    fetch('/api/bids').then(r => r.json()),
    fetch('/api/kpis').then(r => r.json())
  ]);
  renderKpis(kpis);
  renderCharts(kpis);
  renderTable(bids);
}

function money(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function renderKpis(kpis) {
  const cards = [
    { label: 'Total Bids Sent', value: kpis.totalBids, tone: 'default' },
    { label: 'Total Pipeline Revenue', value: money(kpis.totalValue), tone: 'blue' },
    { label: 'Total Projected Profit', value: money(kpis.totalProfit), tone: 'green' },
    { label: 'Estimated Cost', value: money(kpis.estimatedCost), tone: 'default' },
    { label: 'Profit Coverage', value: `${(kpis.profitCoveragePct || 0).toFixed(1)}%`, meta: `${kpis.profitCoverageCount} of ${kpis.totalBids} bids`, tone: 'green' },
    { label: 'Total Units Bid', value: Number(kpis.totalUnits || 0).toLocaleString(), tone: 'default' },
    { label: 'Average Bid', value: money(kpis.avgBid), tone: 'default' },
    { label: 'Average Profit per Bid', value: money(kpis.avgProfitPerBid), tone: 'green' },
    { label: 'Records Needing Review', value: kpis.recordsNeedingReview || 0, tone: kpis.recordsNeedingReview ? 'amber' : 'default' }
  ];
  document.getElementById('kpiRow').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.tone}">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
      ${c.meta ? `<div class="meta">${c.meta}</div>` : ''}
    </div>
  `).join('');
}

function renderCharts(kpis) {
  const companies = Object.entries(kpis.byCompany).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const companyLabels = companies.map(([label]) => label);
  const companyValues = companies.map(([, value]) => value);
  const statusLabels = Object.keys(kpis.byStatus);
  const statusValues = Object.values(kpis.byStatus);
  const monthLabels = Object.keys(kpis.byMonth).sort();
  const monthValues = monthLabels.map(m => kpis.byMonth[m]);

  const palette = ['#2f91ff', '#25d984', '#ffbd3f', '#7d8ba3', '#8b6cff', '#4dc9ff', '#ff6b79'];

  if (companyChart) companyChart.destroy();
  companyChart = new Chart(document.getElementById('companyChart'), {
    type: 'bar',
    data: { labels: companyLabels, datasets: [{ data: companyValues, backgroundColor: '#248cff', borderRadius: 5, borderSkipped: false, maxBarThickness: 42 }] },
    options: baseOpts(true, 'currency')
  });

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: { labels: statusLabels, datasets: [{ data: statusValues, backgroundColor: palette, borderColor: '#142333', borderWidth: 4, hoverOffset: 5 }] },
    options: { ...baseOpts(false), cutout: '66%' }
  });

  if (monthChart) monthChart.destroy();
  monthChart = new Chart(document.getElementById('monthChart'), {
    type: 'line',
    data: { labels: monthLabels.map(formatMonth), datasets: [{ data: monthValues, borderColor: '#2f91ff', backgroundColor: 'rgba(47, 145, 255, .14)', fill: true, tension: 0.38, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#2f91ff', pointBorderColor: '#dceeff', pointBorderWidth: 1 }] },
    options: baseOpts(true)
  });
}

function formatMonth(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

function baseOpts(hasAxes, tickType) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: !hasAxes, position: 'right', labels: { color: '#b9c6d8', usePointStyle: true, pointStyle: 'circle', padding: 18, font: { size: 12, weight: 600 } } },
      tooltip: { backgroundColor: '#0a1520', borderColor: '#2a4055', borderWidth: 1, padding: 12, titleColor: '#fff', bodyColor: '#c8d5e4', callbacks: tickType === 'currency' ? { label: context => ` ${money(context.raw)}` } : {} }
    },
    scales: hasAxes ? {
      x: { ticks: { color: '#8393a8', maxRotation: 0, autoSkip: true, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#8393a8', font: { size: 11 }, callback: tickType === 'currency' ? value => '$' + Intl.NumberFormat('en', { notation: 'compact' }).format(value) : undefined }, grid: { color: 'rgba(126, 151, 178, .13)' }, border: { display: false } }
    } : {}
  };
}

function renderTable(bids) {
  currentBids = [...bids];
  const sortedBids = sortBids(currentBids);
  const body = document.getElementById('bidsBody');
  body.innerHTML = sortedBids.map(b => rowMarkup(b)).join('');
  body.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', () => beginEdit(button, sortedBids)));
  updateSortButtons();
}

function sortValue(bid, key) {
  if (key === 'recipient') return bid.recipient_name || bid.recipient_email || '';
  if (key === 'sent_date') return bid.sent_date || '';
  if (key === 'sent_time') return `${bid.sent_date || ''} ${bid.sent_time || ''}`;
  return bid[key];
}

function sortBids(bids) {
  const multiplier = sortState.direction === 'asc' ? 1 : -1;
  return [...bids].sort((a, b) => {
    const av = sortValue(a, sortState.key);
    const bv = sortValue(b, sortState.key);
    const aMissing = av === null || av === undefined || av === '';
    const bMissing = bv === null || bv === undefined || bv === '';
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (typeof av === 'number' || typeof bv === 'number') return (Number(av) - Number(bv)) * multiplier;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
  });
}

function updateSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(button => {
    const active = button.dataset.sort === sortState.key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-sort', active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('span').textContent = active ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
  });
  const mobileField = document.getElementById('mobileSortField');
  const mobileDirection = document.getElementById('mobileSortDirection');
  if (mobileField) mobileField.value = sortState.key;
  if (mobileDirection) {
    const ascending = sortState.direction === 'asc';
    mobileDirection.textContent = ascending ? 'Ascending ↑' : 'Descending ↓';
    mobileDirection.setAttribute('aria-label', `Sort ${ascending ? 'ascending' : 'descending'}; tap to reverse`);
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rowMarkup(b, editing = false) {
  if (editing) {
    return `
      <tr data-id="${b.id}" class="editing">
        <td data-label="Project"><input value="${esc(b.project_name || '')}" data-field="project_name" aria-label="Project"></td>
        <td data-label="Company"><input value="${esc(b.company_name || '')}" data-field="company_name" aria-label="Company"></td>
        <td data-label="Units"><input type="number" min="0" step="1" value="${b.units ?? ''}" data-field="units" aria-label="Units"></td>
        <td data-label="Bid amount"><div class="money-input"><span>$</span><input type="number" min="0" step="0.01" value="${b.bid_amount ?? ''}" data-field="bid_amount" aria-label="Bid amount"></div></td>
        <td data-label="Projected profit"><div class="money-input profit-input"><span>$</span><input type="number" step="0.01" value="${b.projected_profit ?? ''}" data-field="projected_profit" aria-label="Projected profit"></div></td>
        <td data-label="Sent date"><input type="date" value="${b.sent_date || ''}" data-field="sent_date" aria-label="Sent date"></td>
        <td data-label="Sent time"><input type="time" step="1" value="${b.sent_time || ''}" data-field="sent_time" aria-label="Sent time"></td>
        <td data-label="Sent to"><div class="recipient-edit"><input value="${esc(b.recipient_name || '')}" data-field="recipient_name" aria-label="Recipient name" placeholder="Name"><input type="email" value="${esc(b.recipient_email || '')}" data-field="recipient_email" aria-label="Recipient email" placeholder="Email"></div></td>
        <td data-label="Status"><select data-field="status" aria-label="Status">${statusOptions(b.status)}</select></td>
        <td data-label="Actions"><div class="row-actions"><button class="save-btn" type="button">Save</button><button class="cancel-btn" type="button">Cancel</button></div></td>
      </tr>`;
  }

  return `
    <tr data-id="${b.id}">
      <td data-label="Project"><span class="cell-value project-value">${esc(b.project_name || '—')}</span></td>
      <td data-label="Company"><span class="cell-value">${esc(b.company_name || '—')}</span></td>
      <td data-label="Units"><span class="cell-value number-value">${b.units ?? '—'}</span></td>
      <td data-label="Bid amount"><span class="cell-value money-value">${money(b.bid_amount)}</span></td>
      <td data-label="Projected profit"><span class="cell-value money-value profit-value">${money(b.projected_profit)}</span></td>
      <td data-label="Sent date"><span class="cell-value">${formatDate(b.sent_date)}</span></td>
      <td data-label="Sent time"><span class="cell-value time-value">${formatTime(b.sent_time, b.sent_timezone)}</span></td>
      <td data-label="Sent to">${recipientMarkup(b)}</td>
      <td data-label="Status"><span class="status-badge status-${esc((b.status || 'Sent').toLowerCase().replace(/[^a-z]+/g, '-'))}"><span></span>${esc(b.status || 'Sent')}</span></td>
      <td data-label="Actions"><button class="edit-btn" type="button" aria-label="Edit ${esc(b.project_name || 'bid')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.3-10.3a2.1 2.1 0 0 0-3-3L5.2 16 4 20Zm10-13 3 3"/></svg>Edit</button></td>
    </tr>`;
}

function statusOptions(current) {
  return ['Sent', 'Follow-Up', 'Won', 'Lost'].map(status =>
    `<option value="${status}" ${current === status ? 'selected' : ''}>${status}</option>`).join('');
}

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}

function formatTime(value, timezone) {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  const formatted = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, hour, minute));
  return `${formatted}${timezone ? ` (${esc(timezone)})` : ''}`;
}

function recipientMarkup(b) {
  if (b.email_match_status === 'unverified') {
    return '<span class="email-unverified">No external send found</span>';
  }
  const name = b.recipient_name ? `<strong>${esc(b.recipient_name)}</strong>` : '';
  const email = b.recipient_email ? `<span>${esc(b.recipient_email)}</span>` : '<span>—</span>';
  return `<span class="recipient-value" title="${esc(b.email_subject || '')}">${name}${email}</span>`;
}

function beginEdit(button, bids) {
  const row = button.closest('tr');
  const bid = bids.find(item => String(item.id) === row.dataset.id);
  if (!bid) return;
  document.querySelectorAll('#bidsBody tr.editing .cancel-btn').forEach(cancel => cancel.click());
  row.outerHTML = rowMarkup(bid, true);
  const editingRow = document.querySelector(`#bidsBody tr[data-id="${bid.id}"]`);
  editingRow.querySelector('.save-btn').addEventListener('click', () => saveEdit(editingRow));
  editingRow.querySelector('.cancel-btn').addEventListener('click', () => cancelEdit(editingRow, bid, bids));
  editingRow.querySelector('input').focus();
}

function cancelEdit(row, bid, bids) {
  row.outerHTML = rowMarkup(bid);
  const restoredRow = document.querySelector(`#bidsBody tr[data-id="${bid.id}"]`);
  restoredRow.querySelector('.edit-btn').addEventListener('click', () => beginEdit(restoredRow.querySelector('.edit-btn'), bids));
}

async function saveEdit(row) {
  const id = row.dataset.id;
  const payload = {};
  const numericFields = new Set(['units', 'bid_amount', 'projected_profit']);
  row.querySelectorAll('[data-field]').forEach(control => {
    const field = control.dataset.field;
    payload[field] = numericFields.has(field) && control.value !== '' ? Number(control.value) : control.value;
  });
  row.classList.add('saving');
  const response = await fetch(`/api/bids/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    row.classList.remove('saving');
    showStatus('That change could not be saved.', true);
    return;
  }
  showStatus('Change saved. Dashboard totals refreshed.');
  loadAll();
}

function showStatus(message, isError = false) {
  const el = document.getElementById('uploadStatus');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('visible');
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => el.classList.remove('visible'), 2600);
}

document.getElementById('pdfInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  const statusEl = document.getElementById('uploadStatus');
  statusEl.classList.add('visible');
  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      statusEl.textContent = `Processing ${file.name}...`;
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Upload failed with ${res.status}`);
      }

      const result = await res.json();
      successCount += 1;
      if (result.needs_review) {
        statusEl.textContent = `${file.name} added — extracted with fallback OCR, double-check fields.`;
      } else {
        statusEl.textContent = `${file.name} added.`;
      }
    } catch (err) {
      failCount += 1;
      statusEl.textContent = `${file.name} failed: ${err.message}`;
    }
  }

  showStatus(`Upload complete: ${successCount} succeeded, ${failCount} failed.`, failCount > 0);
  e.target.value = '';
  loadAll();
});

document.querySelectorAll('.sort-btn').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (sortState.key === key) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else {
      sortState.key = key;
      sortState.direction = 'asc';
    }
    renderTable(currentBids);
  });
});

document.getElementById('mobileSortField').addEventListener('change', event => {
  sortState.key = event.target.value;
  renderTable(currentBids);
});

document.getElementById('mobileSortDirection').addEventListener('click', () => {
  sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  renderTable(currentBids);
});

loadAll();
