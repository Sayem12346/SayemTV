/* ══════════════════════════════════════════════════════
   STREAMVAULT — script.js
   ══════════════════════════════════════════════════════ */

const M3U_FILE = 'channels.m3u8';

let allChannels    = [];
let filteredChannels = [];
let currentChannel = null;
let hls            = null;
let favorites      = loadFavorites();
let currentCategory = 'All';
let currentGroup   = 'All';
let isListMode     = false;
let retryChannel   = null;

// ── INIT ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadM3U(M3U_FILE);
  bindUI();
  applyTheme();
  initStickyPlayer();
});

// ── M3U LOADER ───────────────────────────────────────
async function loadM3U(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Not found');
    const text = await res.text();
    allChannels = parseM3U(text);
    buildFilterBar();
    filterChannels();
    updateMeta();
  } catch(e) {
    document.getElementById('channelsGrid').innerHTML =
      '<div class="empty-state"><p>⚠</p><p>Could not load ' + path + '</p></div>';
  }
}

// ── PARSER ───────────────────────────────────────────
function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('#EXTINF')) {
      const info = lines[i];
      const url  = lines[i + 1] || '';
      i += 2;
      if (!url || url.startsWith('#')) continue;
      if (/facebook\.com|youtube\.com|youtu\.be|twitch\.tv/i.test(url)) continue;

      const attr = {};
      const re = /([\w-]+)="([^"]*?)"/g; let m;
      while ((m = re.exec(info)) !== null) attr[m[1]] = m[2];

      const parts = info.split(',');
      const name  = (parts[parts.length - 1] || attr['tvg-name'] || 'Unknown')
                      .trim().replace(/[ⓢⓣⓨⓖ◉]/gi, '').trim();

      channels.push({
        name,
        url: url.trim(),
        logo:  attr['tvg-logo']    || '',
        group: attr['group-title'] || 'Other',
        country: attr['tvg-country'] || '',
      });
    } else { i++; }
  }
  return channels;
}

// ── META ─────────────────────────────────────────────
function updateMeta() {
  const total     = allChannels.length;
  const countries = new Set(allChannels.map(c => c.group)).size;
  document.getElementById('metaChannels').textContent  = total.toLocaleString();
  document.getElementById('metaCountries').textContent = countries;
  document.getElementById('heroCount').textContent     = total.toLocaleString();
  document.getElementById('hintCount').textContent     = total.toLocaleString();
}

// ── FILTER BAR ───────────────────────────────────────
function buildFilterBar() {
  const groups = ['All', ...new Set(allChannels.map(c => c.group))].sort((a,b) => a === 'All' ? -1 : a.localeCompare(b));
  const bar = document.getElementById('filterBar');
  bar.innerHTML = '';
  groups.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (g === 'All' ? ' active' : '');
    btn.textContent = g === 'All' ? 'ALL' : g.toUpperCase();
    btn.dataset.group = g;
    btn.addEventListener('click', () => setGroup(g));
    bar.appendChild(btn);
  });
}

function setGroup(g) {
  currentGroup = g;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.group === g));
  const title = g === 'All' ? 'ALL CHANNELS' : g.toUpperCase();
  document.getElementById('catDividerTitle').textContent = title;
  filterChannels();
}

// ── CATEGORY (nav) ───────────────────────────────────
function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.nav-link[data-cat], .mob-btn[data-cat]').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  filterChannels();
}

// ── FILTER ───────────────────────────────────────────
function filterChannels() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();

  let pool;
  if (currentCategory === '__favorites__') {
    pool = allChannels.filter(c => favorites.includes(chKey(c)));
  } else {
    pool = allChannels;
  }

  if (currentGroup !== 'All') {
    pool = pool.filter(c => c.group === currentGroup);
  }

  if (q) {
    pool = pool.filter(c =>
      c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }

  filteredChannels = pool;
  document.getElementById('showingCount').textContent =
    `Showing ${pool.length.toLocaleString()} channels`;
  renderChannels();
}

// ── RENDER ───────────────────────────────────────────
function renderChannels() {
  const grid = document.getElementById('channelsGrid');
  grid.innerHTML = '';

  if (!filteredChannels.length) {
    grid.innerHTML = '<div class="empty-state"><p>∅</p><p>No channels found</p></div>';
    return;
  }

  const BATCH = 120;
  let done = 0;
  function batch() {
    const end = Math.min(done + BATCH, filteredChannels.length);
    for (let i = done; i < end; i++) grid.appendChild(makeCard(filteredChannels[i], i));
    done = end;
    if (done < filteredChannels.length) requestAnimationFrame(batch);
  }
  batch();
}

function makeCard(ch, idx) {
  const isFav     = favorites.includes(chKey(ch));
  const isPlaying = currentChannel && chKey(currentChannel) === chKey(ch);

  const card = document.createElement('div');
  card.className = 'channel-card' + (isPlaying ? ' playing' : '');
  card.style.animationDelay = `${Math.min(idx * 0.018, 0.5)}s`;

  card.innerHTML = `
    <div class="card-logo-wrap">
      ${ch.logo ? `<img src="${ch.logo}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">` : ''}
      <span class="card-logo-placeholder" ${ch.logo ? 'style="display:none"' : ''}>📺</span>
    </div>
    <span class="card-name">${esc(ch.name)}</span>
    <span class="card-group">${esc(ch.group)}</span>
    <button class="card-fav ${isFav ? 'active' : ''}">${isFav ? '★' : '☆'}</button>
  `;

  card.addEventListener('click', e => { if (!e.target.classList.contains('card-fav')) playChannel(ch); });
  card.querySelector('.card-fav').addEventListener('click', e => {
    e.stopPropagation();
    toggleFav(ch, card.querySelector('.card-fav'));
  });
  return card;
}

// ── PLAYER ───────────────────────────────────────────
function playChannel(ch) {
  currentChannel = ch;
  retryChannel   = ch;

  document.getElementById('playerPlaceholder').style.display = 'none';
  document.getElementById('playerError').classList.remove('visible');
  document.getElementById('playerLoading').classList.add('visible');

  const video   = document.getElementById('videoPlayer');
  const overlay = document.getElementById('playerOverlay');
  video.classList.add('active');
  overlay.classList.add('active');

  document.getElementById('nowName').textContent  = ch.name;
  document.getElementById('nowGroup').textContent = ch.group;
  const logo = document.getElementById('nowLogo');
  logo.src = ch.logo || ''; logo.style.display = ch.logo ? 'block' : 'none';

  syncFavBtn(ch);

  document.querySelectorAll('.channel-card').forEach(c => {
    c.classList.toggle('playing', c.querySelector('.card-name')?.textContent === ch.name);
  });

  if (hls) { hls.destroy(); hls = null; }
  video.pause(); video.src = '';

  const url = ch.url;

  if (Hls.isSupported() && /\.m3u8|playlist|chunks/i.test(url)) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      document.getElementById('playerLoading').classList.remove('visible');
    });
    hls.on(Hls.Events.ERROR, (e, d) => {
      if (d.fatal) {
        document.getElementById('playerLoading').classList.remove('visible');
        document.getElementById('playerError').classList.add('visible');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().catch(() => {});
    document.getElementById('playerLoading').classList.remove('visible');
  } else {
    video.src = url;
    video.play().then(() => {
      document.getElementById('playerLoading').classList.remove('visible');
    }).catch(() => {
      document.getElementById('playerLoading').classList.remove('visible');
      document.getElementById('playerError').classList.add('visible');
    });
  }

  if (window.innerWidth < 900) {
    document.getElementById('playerSection').scrollIntoView({ behavior: 'smooth' });
  }
}

function retryStream() { if (retryChannel) playChannel(retryChannel); }

// ── FAVOURITES ───────────────────────────────────────
function chKey(ch) { return `${ch.name}||${ch.url}`; }

function toggleFav(ch, btn) {
  const key = chKey(ch);
  if (favorites.includes(key)) {
    favorites = favorites.filter(k => k !== key);
    if (btn) { btn.textContent = '☆'; btn.classList.remove('active'); }
  } else {
    favorites.push(key);
    if (btn) { btn.textContent = '★'; btn.classList.add('active'); }
  }
  saveFavorites();
  syncFavBtn(ch);
  if (currentCategory === '__favorites__') filterChannels();
}

function syncFavBtn(ch) {
  const isFav = favorites.includes(chKey(ch));
  const btn   = document.getElementById('favBtn');
  btn.textContent = isFav ? '★' : '☆';
  btn.classList.toggle('fav-active', isFav);
}

function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('sv_fav') || '[]'); } catch { return []; }
}
function saveFavorites() { localStorage.setItem('sv_fav', JSON.stringify(favorites)); }

// ── STICKY PLAYER ────────────────────────────────────
function initStickyPlayer() {
  const wrapper = document.getElementById('playerWrapper');
  const section = document.getElementById('playerSection');
  const spacer  = document.getElementById('playerSpace');
  const closeBtn = document.getElementById('stickyClose');
  if (!wrapper || !section) return;

  let sticky = false;

  const obs = new IntersectionObserver(entries => {
    const entry = entries[0];
    const video = document.getElementById('videoPlayer');
    const playing = video && !video.paused && video.readyState > 2;

    if (!entry.isIntersecting && playing && !sticky) {
      sticky = true;
      wrapper.classList.add('is-sticky');
      spacer.classList.add('visible');
    } else if (entry.isIntersecting && sticky) {
      sticky = false;
      wrapper.classList.remove('is-sticky');
      spacer.classList.remove('visible');
    }
  }, { threshold: 0.1 });

  obs.observe(section);

  closeBtn.addEventListener('click', () => {
    sticky = false;
    wrapper.classList.remove('is-sticky');
    spacer.classList.remove('visible');
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ── BIND UI ──────────────────────────────────────────
function bindUI() {
  // Search open/close
  const searchWrap = document.getElementById('searchWrap');
  document.getElementById('navSearch').addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    if (searchWrap.classList.contains('open')) document.getElementById('searchInput').focus();
  });
  document.getElementById('searchInput').addEventListener('input', filterChannels);

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchWrap.classList.add('open');
      document.getElementById('searchInput').focus();
    }
    if (e.key === 'Escape') searchWrap.classList.remove('open');
  });

  // Nav category buttons
  document.querySelectorAll('.nav-link[data-cat]').forEach(b =>
    b.addEventListener('click', () => setCategory(b.dataset.cat))
  );

  // Mobile bar
  document.querySelectorAll('.mob-btn[data-cat]').forEach(b =>
    b.addEventListener('click', () => setCategory(b.dataset.cat))
  );
  const mobSearch = document.getElementById('mobSearchBtn');
  if (mobSearch) mobSearch.addEventListener('click', () => {
    searchWrap.classList.toggle('open');
    document.getElementById('searchInput').focus();
  });

  // Theme
  document.getElementById('themeToggle').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = dark ? '' : 'dark';
    localStorage.setItem('sv_theme', dark ? '' : 'dark');
  });

  // View
  document.getElementById('gridView').addEventListener('click', () => setView(false));
  document.getElementById('listView').addEventListener('click', () => setView(true));

  // Player controls
  document.getElementById('favBtn').addEventListener('click', () => {
    if (currentChannel) toggleFav(currentChannel, null);
  });
  document.getElementById('pipBtn').addEventListener('click', async () => {
    const v = document.getElementById('videoPlayer');
    try {
      document.pictureInPictureElement ? await document.exitPictureInPicture()
                                       : await v.requestPictureInPicture();
    } catch {}
  });
  document.getElementById('fsBtn').addEventListener('click', () => {
    const c = document.getElementById('playerContainer');
    document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen().catch(() => {});
  });
}

function setView(list) {
  isListMode = list;
  document.getElementById('channelsGrid').classList.toggle('list-mode', list);
  document.getElementById('gridView').classList.toggle('active', !list);
  document.getElementById('listView').classList.toggle('active', list);
}

// ── THEME ────────────────────────────────────────────
function applyTheme() {
  const t = localStorage.getItem('sv_theme');
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
}

// ── HELPERS ──────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
