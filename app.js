(function () {
  'use strict';

  const STORAGE_KEY = 'reading-log:v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    entries: [],
    filters: { search: '', status: '', platform: '', tag: '' }
  };

  // ---------- Storage ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.entries)) state.entries = [];
    } catch (e) {
      console.error('Failed to load entries', e);
      state.entries = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  }

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function detectPlatform(url) {
    if (!url) return '';
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
    host = host.replace(/^www\./, '');
    if (host.endsWith('substack.com') || host.includes('.substack.')) return 'Substack';
    if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return 'X/Twitter';
    if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) return 'YouTube';
    if (host === 'medium.com' || host.endsWith('.medium.com')) return 'Medium';
    if (host === 'github.com' || host.endsWith('.github.com') || host.endsWith('.github.io')) return 'GitHub';
    if (host === 'news.ycombinator.com') return 'Hacker News';
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'Reddit';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'LinkedIn';
    if (host.endsWith('.arxiv.org') || host === 'arxiv.org') return 'arXiv';
    // Default: capitalize primary domain label
    const label = host.split('.').slice(-2, -1)[0] || host;
    return label ? label[0].toUpperCase() + label.slice(1) : 'Other';
  }

  function extractUrlFromText(text) {
    if (!text) return null;
    const m = text.match(/https?:\/\/[^\s"')]+/);
    return m ? m[0] : null;
  }

  function parseTags(raw) {
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  function formatTags(tags) {
    return (tags || []).join(', ');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const opts = sameYear
      ? { month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString(undefined, opts);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- CRUD ----------
  function upsertEntry(data) {
    const now = new Date().toISOString();
    if (data.id) {
      const idx = state.entries.findIndex(e => e.id === data.id);
      if (idx >= 0) {
        state.entries[idx] = { ...state.entries[idx], ...data, updatedAt: now };
      }
    } else {
      const entry = {
        id: uid(),
        title: data.title || 'Untitled',
        url: data.url || '',
        platform: data.platform || detectPlatform(data.url),
        highlight: data.highlight || '',
        notes: data.notes || '',
        tags: data.tags || [],
        status: data.status || 'Saved',
        createdAt: now,
        updatedAt: now
      };
      state.entries.unshift(entry);
    }
    save();
  }

  function deleteEntry(id) {
    state.entries = state.entries.filter(e => e.id !== id);
    save();
  }

  function getEntry(id) {
    return state.entries.find(e => e.id === id);
  }

  // ---------- Rendering ----------
  function applyFilters() {
    const { search, status, platform, tag } = state.filters;
    const q = search.trim().toLowerCase();
    return state.entries.filter(e => {
      if (status && e.status !== status) return false;
      if (platform && e.platform !== platform) return false;
      if (tag && !(e.tags || []).includes(tag)) return false;
      if (q) {
        const hay = [e.title, e.highlight, e.notes, (e.tags || []).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    renderEntries();
    renderFilterOptions();
  }

  function renderEntries() {
    const listEl = $('#entries');
    const emptyEl = $('#empty-state');
    const filtered = applyFilters().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      emptyEl.classList.remove('hidden');
      emptyEl.querySelector('p').textContent =
        state.entries.length === 0 ? 'No entries yet.' : 'No entries match these filters.';
      return;
    }
    emptyEl.classList.add('hidden');

    const frag = document.createDocumentFragment();
    for (const e of filtered) {
      const li = document.createElement('li');
      li.className = 'entry';
      li.tabIndex = 0;
      li.dataset.id = e.id;
      li.setAttribute('role', 'button');

      const tagsHtml = (e.tags || []).map(t =>
        `<span class="tag">${escapeHtml(t)}</span>`
      ).join('');

      li.innerHTML = `
        <h3 class="entry-title">${escapeHtml(e.title || 'Untitled')}</h3>
        <div class="entry-meta">
          <span class="pill status-${escapeHtml(e.status || 'Saved')}">${escapeHtml(e.status || 'Saved')}</span>
          ${e.platform ? `<span>${escapeHtml(e.platform)}</span>` : ''}
          <span>${escapeHtml(formatDate(e.createdAt))}</span>
        </div>
        ${e.highlight ? `<p class="entry-highlight">${escapeHtml(e.highlight)}</p>` : ''}
        ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ''}
      `;
      frag.appendChild(li);
    }
    listEl.appendChild(frag);
  }

  function renderFilterOptions() {
    const platforms = Array.from(new Set(state.entries.map(e => e.platform).filter(Boolean))).sort();
    const tags = Array.from(new Set(state.entries.flatMap(e => e.tags || []))).sort();

    rebuildSelect('#filter-platform', platforms, state.filters.platform, 'All platforms');
    rebuildSelect('#filter-tag', tags, state.filters.tag, 'All tags');
  }

  function rebuildSelect(sel, values, current, allLabel) {
    const el = $(sel);
    const prev = el.value;
    el.innerHTML = `<option value="">${allLabel}</option>` +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    el.value = values.includes(current) ? current : (values.includes(prev) ? prev : '');
  }

  // ---------- Modal / Form ----------
  function openEntryModal(entry) {
    const form = $('#entry-form');
    form.reset();
    $('#modal-title').textContent = entry ? 'Edit Entry' : 'New Entry';
    $('#btn-delete').classList.toggle('hidden', !entry);

    if (entry) {
      form.elements.id.value = entry.id;
      form.elements.title.value = entry.title || '';
      form.elements.url.value = entry.url || '';
      form.elements.platform.value = entry.platform || '';
      form.elements.highlight.value = entry.highlight || '';
      form.elements.notes.value = entry.notes || '';
      form.elements.tags.value = formatTags(entry.tags);
      form.elements.status.value = entry.status || 'Saved';
    } else {
      form.elements.id.value = '';
      form.elements.status.value = 'Saved';
    }
    $('#modal').classList.remove('hidden');
    setTimeout(() => form.elements.title.focus(), 30);
  }

  function closeEntryModal() {
    $('#modal').classList.add('hidden');
  }

  function submitEntryForm(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      id: fd.get('id') || '',
      title: (fd.get('title') || '').toString().trim(),
      url: (fd.get('url') || '').toString().trim(),
      platform: (fd.get('platform') || '').toString().trim(),
      highlight: (fd.get('highlight') || '').toString(),
      notes: (fd.get('notes') || '').toString(),
      tags: parseTags((fd.get('tags') || '').toString()),
      status: (fd.get('status') || 'Saved').toString()
    };
    if (!data.platform) data.platform = detectPlatform(data.url);
    if (!data.title) data.title = data.url || 'Untitled';
    upsertEntry(data);
    closeEntryModal();
    render();
  }

  function openDetail(id) {
    const e = getEntry(id);
    if (!e) return;
    $('#detail-title').textContent = e.title || 'Untitled';
    const urlHtml = e.url
      ? `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.url)}</a>`
      : '<span class="muted">—</span>';
    const tagsHtml = (e.tags && e.tags.length)
      ? `<div class="entry-tags">${e.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '<span class="muted">—</span>';
    $('#detail-body').innerHTML = `
      <div>
        <h3>Status</h3>
        <div class="detail-value"><span class="pill status-${escapeHtml(e.status)}">${escapeHtml(e.status)}</span></div>
      </div>
      <div>
        <h3>Platform</h3>
        <div class="detail-value">${escapeHtml(e.platform || '—')}</div>
      </div>
      <div>
        <h3>URL</h3>
        <div class="detail-value">${urlHtml}</div>
      </div>
      <div>
        <h3>Saved</h3>
        <div class="detail-value">${escapeHtml(new Date(e.createdAt).toLocaleString())}</div>
      </div>
      ${e.highlight ? `<div><h3>Highlight</h3><div class="detail-quote">${escapeHtml(e.highlight)}</div></div>` : ''}
      ${e.notes ? `<div><h3>Notes</h3><div class="detail-value">${escapeHtml(e.notes)}</div></div>` : ''}
      <div>
        <h3>Tags</h3>
        <div class="detail-value">${tagsHtml}</div>
      </div>
    `;
    $('#btn-detail-edit').dataset.id = e.id;
    $('#btn-detail-delete').dataset.id = e.id;
    $('#detail').classList.remove('hidden');
  }

  function closeDetail() { $('#detail').classList.add('hidden'); }

  // ---------- Export / Import ----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `reading-log-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJSON(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Expected an array');
      const existingIds = new Set(state.entries.map(e => e.id));
      let added = 0;
      for (const raw of parsed) {
        if (!raw || typeof raw !== 'object') continue;
        const entry = {
          id: raw.id && !existingIds.has(raw.id) ? raw.id : uid(),
          title: String(raw.title || 'Untitled'),
          url: String(raw.url || ''),
          platform: String(raw.platform || detectPlatform(raw.url) || ''),
          highlight: String(raw.highlight || ''),
          notes: String(raw.notes || ''),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : parseTags(String(raw.tags || '')),
          status: ['Saved', 'Reading', 'Done'].includes(raw.status) ? raw.status : 'Saved',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString()
        };
        existingIds.add(entry.id);
        state.entries.push(entry);
        added++;
      }
      state.entries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      save();
      render();
      alert(`Imported ${added} entr${added === 1 ? 'y' : 'ies'}.`);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  }

  // ---------- Share Target handling ----------
  function handleShareIntent() {
    const params = new URLSearchParams(window.location.search);
    const hasShare = ['title', 'text', 'url'].some(k => params.has(k));
    const isShareRoute = window.location.pathname === '/share';
    if (!hasShare && !isShareRoute) return;

    const sharedUrl = params.get('url') || extractUrlFromText(params.get('text') || '') || '';
    const sharedText = params.get('text') || '';
    const sharedTitle = params.get('title') || '';
    const autosave = params.get('autosave') === '1' || params.get('auto') === '1';
    const tagsParam = params.get('tags') || '';
    const notesParam = params.get('notes') || '';

    // If text contains a URL but url param is empty, strip the URL from text when using as highlight
    let highlight = sharedText;
    if (sharedUrl && sharedText && sharedText.includes(sharedUrl)) {
      highlight = sharedText.replace(sharedUrl, '').trim();
    }

    // Title: prefer explicit title; fall back to a trimmed snippet of text; else URL
    let title = sharedTitle;
    if (!title && highlight) title = highlight.slice(0, 140);
    if (!title) title = sharedUrl;

    const cleanUrl = () => {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', '/');
      }
    };

    if (autosave) {
      upsertEntry({
        title,
        url: sharedUrl,
        platform: detectPlatform(sharedUrl),
        highlight,
        notes: notesParam,
        tags: parseTags(tagsParam),
        status: 'Saved'
      });
      render();
      showToast('Saved ✓');
      cleanUrl();
      return;
    }

    openEntryModal(null);
    const form = $('#entry-form');
    form.elements.title.value = title;
    form.elements.url.value = sharedUrl;
    form.elements.platform.value = detectPlatform(sharedUrl);
    form.elements.highlight.value = highlight;
    if (notesParam) form.elements.notes.value = notesParam;
    if (tagsParam) form.elements.tags.value = tagsParam;
    cleanUrl();
  }

  let toastTimer = null;
  function showToast(message) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('toast-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('toast-visible'), 1800);
  }

  // ---------- Service worker ----------
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  // ---------- Wire up ----------
  function bind() {
    $('#btn-new').addEventListener('click', () => openEntryModal(null));
    $('#btn-close').addEventListener('click', closeEntryModal);
    $('#btn-detail-close').addEventListener('click', closeDetail);

    $('#modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeEntryModal();
    });
    $('#detail').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeDetail();
    });
    $('#about').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) $('#about').classList.add('hidden');
    });
    $('#btn-about-close').addEventListener('click', () => $('#about').classList.add('hidden'));

    $('#entry-form').addEventListener('submit', submitEntryForm);

    $('#btn-delete').addEventListener('click', () => {
      const id = $('#entry-form').elements.id.value;
      if (!id) return;
      if (confirm('Delete this entry?')) {
        deleteEntry(id);
        closeEntryModal();
        render();
      }
    });

    $('#btn-detail-edit').addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const entry = getEntry(id);
      closeDetail();
      openEntryModal(entry);
    });
    $('#btn-detail-delete').addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      if (confirm('Delete this entry?')) {
        deleteEntry(id);
        closeDetail();
        render();
      }
    });

    $('#entries').addEventListener('click', (e) => {
      const li = e.target.closest('.entry');
      if (!li) return;
      openDetail(li.dataset.id);
    });
    $('#entries').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const li = e.target.closest('.entry');
      if (!li) return;
      e.preventDefault();
      openDetail(li.dataset.id);
    });

    $('#search').addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderEntries();
    });
    $('#filter-status').addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      renderEntries();
    });
    $('#filter-platform').addEventListener('change', (e) => {
      state.filters.platform = e.target.value;
      renderEntries();
    });
    $('#filter-tag').addEventListener('change', (e) => {
      state.filters.tag = e.target.value;
      renderEntries();
    });

    // Menu
    const menu = $('#menu-dropdown');
    const menuBtn = $('#btn-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      menu.classList.toggle('hidden', isOpen);
      menuBtn.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== menuBtn) {
        menu.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });

    $('#btn-export').addEventListener('click', () => {
      menu.classList.add('hidden');
      exportJSON();
    });
    $('#btn-import').addEventListener('click', () => {
      menu.classList.add('hidden');
      $('#file-import').click();
    });
    $('#file-import').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJSON(f);
      e.target.value = '';
    });
    $('#btn-about').addEventListener('click', () => {
      menu.classList.add('hidden');
      const origin = window.location.origin || 'https://your-app.vercel.app';
      const example = `${origin}/share?autosave=1&url=…&title=…&text=…`;
      const el = $('#share-url-example');
      if (el) el.textContent = example;
      $('#about').classList.remove('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) closeEntryModal();
        else if (!$('#detail').classList.contains('hidden')) closeDetail();
        else if (!$('#about').classList.contains('hidden')) $('#about').classList.add('hidden');
      }
    });
  }

  // ---------- Boot ----------
  load();
  bind();
  render();
  handleShareIntent();
  registerSW();
})();
