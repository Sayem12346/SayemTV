/* ─── StreamVault — script.js ─────────────────────── */

const M3U_FILE = 'channels.m3u8'; // ← Change this path if needed

let allChannels = [];
let filteredChannels = [];
let currentChannel = null;
let hls = null;
let favorites = loadFavorites();
let currentCategory = 'All';
let isListMode = false;
let retryChannel = null;

// ─── INIT ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadM3U(M3U_FILE);
  bindUI();
  applyTheme();
});

// ─── M3U LOADER ──────────────────────────────────────
async function loadM3U(path) {
  try {
    showLoading(true);
    const res = await fetch(path);
    if (!res.ok) throw new Error('File not found');
    const text = await res.text();
    allChannels = parseM3U(text);
    buildCategoryNav();
    filterChannels();
    updateCounts();
    document.getElementById('hintCount').textContent = allChannels.length;
  } catch (e) {
    console.error('M3U Load Error:', e);
    showEmptyState('⚠ Could not load ' + path);
  } finally {
    showLoading(false);
  }
}

// ─── M3U PARSER ──────────────────────────────────────
function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF')) {
      const infoLine = lines[i];
      const url = lines[i + 1] || '';
      i += 2;

      if (!url || url.startsWith('#')) continue;

      const attrs = {};
      const attrRegex = /([\w-]+)="([^"]*?)"/g;
      let m;
      while ((m = attrRegex.exec(infoLine)) !== null) {
        attrs[m[1]] = m[2];
      }

      // Name: last comma-separated part
      const nameParts = infoLine.split(',');
      const name = nameParts[nameParts.length - 1].trim() || attrs['tvg-name'] || 'Unknown';

      channels.push({
        name: name.replace(/[ⓢⓣⓨⓖ]/gi, '').trim(),
        url: url.trim(),
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || 'Other',
        country: attrs['tvg-country'] || '',
        id: attrs['tvg-id'] || ''
      });
    } else {
      i++;
    }
  }
  return channels;
}

// ─── CATEGORY NAV ────────────────────────────────────
function buildCategoryNav() {
  const groups = [...new Set(allChannels.map(c => c.group))].sort();
  const nav = document.getElementById('countryNav');
  nav.innerHTML = '';

  groups.forEach(group => {
    const count = allChannels.filter(c => c.group === group).length;
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = group;
    btn.innerHTML = `<span class="cat-icon">◉</span><span>${group}</span><span class="cat-count">${count}</span>`;
    btn.addEventListener('click', () => setCategory(group));
    nav.appendChild(btn);
  });
}

function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  const active = document.querySelector(`[data-cat="${CSS.escape(cat)}"]`);
  if (active) active.classList.add('active');

  // Update title
  let title = cat === 'All' ? 'All Channels' : cat === '__favorites__' ? '★ Favourites' : cat;
  document.getElementById('channelsTitle').textContent = title;

  filterChannels();
}

// ─── FILTER ──────────────────────────────────────────
function filterChannels() {
  const query = document.getElementById('searchInput').value.toLowerCase();

  let pool;
  if (currentCategory === '__favorites__') {
    pool = allChannels.filter(c => favorites.includes(channelKey(c)));
  } else if (currentCategory === 'All') {
    pool = allChannels;
  } else {
    pool = allChannels.filter(c => c.group === currentCategory);
  }

  if (query) {
    pool = pool.filter(c => c.name.toLowerCase().includes(query) || c.group.toLowerCase().includes(query));
  }

  filteredChannels = pool;
  renderChannels();
}

// ─── RENDER ──────────────────────────────────────────
function renderChannels() {
  const grid = document.getElementById('channelsGrid');
  grid.innerHTML = '';

  if (filteredChannels.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>📭</p><p>No channels found</p></div>';
    return;
  }

  // Limit render for performance but load in batches
  const BATCH = 100;
  let rendered = 0;

  function renderBatch() {
    const end = Math.min(rendered + BATCH, filteredChannels.length);
    for (let i = rendered; i < end; i++) {
      const card = createCard(filteredChannels[i], i);
      grid.appendChild(card);
    }
    rendered = end;
    if (rendered < filteredChannels.length) {
      requestAnimationFrame(renderBatch);
    }
  }
  renderBatch();
}

function createCard(ch, idx) {
  const isFav = favorites.includes(channelKey(ch));
  const isPlaying = currentChannel && channelKey(currentChannel) === channelKey(ch);

  const card = document.createElement('div');
  card.className = 'channel-card' + (isPlaying ? ' playing' : '');
  card.style.animationDelay = `${Math.min(idx * 0.02, 0.4)}s`;

  const logoHtml = ch.logo
    ? `<img src="${ch.logo}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`
    : '';

  card.innerHTML = `
    <div class="card-logo-wrap">
      ${logoHtml}
      <span class="card-logo-placeholder" ${ch.logo ? 'style="display:none"' : ''}>📺</span>
    </div>
    <span class="card-name">${escHtml(ch.name)}</span>
    <span class="card-country">${escHtml(ch.group)}</span>
    <button class="card-fav ${isFav ? 'active' : ''}" title="Favourite">${isFav ? '★' : '☆'}</button>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('card-fav')) return;
    playChannel(ch);
  });

  card.querySelector('.card-fav').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(ch, card.querySelector('.card-fav'));
  });

  return card;
}

// ─── PLAYER ──────────────────────────────────────────
function playChannel(ch) {
  currentChannel = ch;
  retryChannel = ch;

  // UI update
  document.getElementById('playerPlaceholder').style.display = 'none';
  document.getElementById('playerError').classList.remove('visible');
  document.getElementById('playerLoading').classList.add('visible');

  const video = document.getElementById('videoPlayer');
  video.classList.add('active');

  const overlay = document.getElementById('playerOverlay');
  overlay.classList.add('active');

  // Info bar
  document.getElementById('nowName').textContent = ch.name;
  document.getElementById('nowGroup').textContent = ch.group;
  const logo = document.getElementById('nowLogo');
  if (ch.logo) { logo.src = ch.logo; logo.style.display = 'block'; }
  else { logo.style.display = 'none'; }

  // Fav button
  updateFavBtn(ch);

  // Highlight card
  document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('playing'));
  // find and mark active card
  const cards = document.querySelectorAll('.channel-card');
  cards.forEach(card => {
    if (card.querySelector('.card-name')?.textContent === ch.name) {
      card.classList.add('playing');
    }
  });

  // Destroy old HLS
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.src = '';

  const url = ch.url;

  if (Hls.isSupported() && (url.includes('.m3u8') || url.includes('playlist'))) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      document.getElementById('playerLoading').classList.remove('visible');
    });
    hls.on(Hls.Events.ERROR, (e, data) => {
      if (data.fatal) {
        document.getElementById('playerLoading').classList.remove('visible');
        document.getElementById('playerError').classList.add('visible');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    video.src = url;
    video.play().catch(() => {});
    document.getElementById('playerLoading').classList.remove('visible');
  } else {
    // Direct URL fallback
    video.src = url;
    video.play().then(() => {
      document.getElementById('playerLoading').classList.remove('visible');
    }).catch(() => {
      document.getElementById('playerLoading').classList.remove('visible');
      document.getElementById('playerError').classList.add('visible');
    });
  }

  // Scroll player into view on mobile
  if (window.innerWidth < 768) {
    document.getElementById('playerSection').scrollIntoView({ behavior: 'smooth' });
  }
}

function retryStream() {
  if (retryChannel) playChannel(retryChannel);
}

// ─── FAVOURITES ──────────────────────────────────────
function channelKey(ch) {
  return `${ch.name}|${ch.url}`;
}

function toggleFavorite(ch, btn) {
  const key = channelKey(ch);
  if (favorites.includes(key)) {
    favorites = favorites.filter(k => k !== key);
    btn.textContent = '☆';
    btn.classList.remove('active');
  } else {
    favorites.push(key);
    btn.textContent = '★';
    btn.classList.add('active');
  }
  saveFavorites();
  updateCounts();
  updateFavBtn(ch);
  if (currentCategory === '__favorites__') filterChannels();
}

function updateFavBtn(ch) {
  const btn = document.getElementById('favBtn');
  const isFav = favorites.includes(channelKey(ch));
  btn.textContent = isFav ? '★' : '☆';
  btn.className = 'cib-btn' + (isFav ? ' fav-active' : '');
}

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('sv_favorites') || '[]'); }
  catch { return []; }
}

function saveFavorites() {
  localStorage.setItem('sv_favorites', JSON.stringify(favorites));
}

function updateCounts() {
  document.getElementById('totalCount').textContent = allChannels.length;
  document.getElementById('favCount').textContent = favorites.length;
}

// ─── UI BINDINGS ─────────────────────────────────────
function bindUI() {
  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', filterChannels);
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape') searchInput.blur();
  });

  // Category nav
  document.querySelectorAll('.cat-btn[data-cat="All"]').forEach(b =>
    b.addEventListener('click', () => setCategory('All'))
  );
  document.querySelector('[data-cat="__favorites__"]')
    .addEventListener('click', () => setCategory('__favorites__'));

  // Fav toggle (header)
  document.getElementById('favToggle').addEventListener('click', () => setCategory('__favorites__'));

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = !document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = isDark ? 'light' : '';
    localStorage.setItem('sv_theme', isDark ? 'light' : 'dark');
  });

  // View mode
  document.getElementById('gridView').addEventListener('click', () => setView(false));
  document.getElementById('listView').addEventListener('click', () => setView(true));

  // Player controls
  document.getElementById('pipBtn').addEventListener('click', togglePiP);
  document.getElementById('fsBtn').addEventListener('click', toggleFullscreen);
  document.getElementById('favBtn').addEventListener('click', () => {
    if (currentChannel) {
      // find the matching card fav btn
      const cards = document.querySelectorAll('.channel-card');
      let btn = null;
      cards.forEach(card => {
        if (card.querySelector('.card-name')?.textContent === currentChannel.name) {
          btn = card.querySelector('.card-fav');
        }
      });
      toggleFavorite(currentChannel, btn || document.getElementById('favBtn'));
    }
  });

  // Mobile menu
  const mobileBtn = document.getElementById('mobileMenu');
  const sidebar = document.getElementById('sidebar');
  mobileBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

function setView(listMode) {
  isListMode = listMode;
  const grid = document.getElementById('channelsGrid');
  grid.classList.toggle('list-mode', listMode);
  document.getElementById('gridView').classList.toggle('active', !listMode);
  document.getElementById('listView').classList.toggle('active', listMode);
}

async function togglePiP() {
  const video = document.getElementById('videoPlayer');
  if (!video.src && !video.currentSrc) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  } catch (e) { console.warn('PiP not supported'); }
}

function toggleFullscreen() {
  const container = document.getElementById('playerContainer');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// ─── THEME ───────────────────────────────────────────
function applyTheme() {
  const saved = localStorage.getItem('sv_theme');
  if (saved === 'light') document.documentElement.dataset.theme = 'light';
}

// ─── HELPERS ─────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showLoading(show) {
  // Could add a global spinner if desired
}

function showEmptyState(msg) {
  const grid = document.getElementById('channelsGrid');
  grid.innerHTML = `<div class="empty-state"><p>⚠</p><p>${msg}</p></div>`;
}
