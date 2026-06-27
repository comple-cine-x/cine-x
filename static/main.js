// ═══════════════════════════════════════════
// CINEX — main.js
// Lógica principal: búsqueda, TMDB, render
// ═══════════════════════════════════════════

const TMDB_KEY = "";
const IMG_BASE  = 'https://image.tmdb.org/t/p/w342';
const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const HERO_BACKDROP_TITLES = [
  { title: 'Casablanca', year: '1942' },
  { title: 'Citizen Kane', year: '1941' },
  { title: 'Vertigo', year: '1958' },
  { title: 'Seven Samurai', year: '1954' },
  { title: '2001: A Space Odyssey', year: '1968' },
  { title: 'In the Mood for Love', year: '2000' }
];
const posterCache = {};
const tmdbDetailCache = {};
let usuarioActual = '';

window.addEventListener('load', () => {
  const pct   = document.getElementById('progPct');
  const start = Date.now();
  const dur   = 1800;
  let raf;
  function updatePct() {
    const elapsed = Date.now() - start;
    const p = Math.min(100, Math.round((elapsed / dur) * 100));
    if (pct) pct.textContent = p + '%';
    if (p < 100) raf = requestAnimationFrame(updatePct);
  }
  setTimeout(() => { raf = requestAnimationFrame(updatePct); }, 1300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (pct) pct.textContent = '100%';
    document.getElementById('intro').classList.add('hidden');
    document.getElementById('app').classList.add('visible');
    animateStats();
  }, 3400);
});

function formatStatValue(value, el) {
  const divisor = parseFloat(el.dataset.divisor || '1');
  const suffix  = el.dataset.suffix || '';
  if (divisor > 1) {
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    return (value / divisor).toFixed(decimals) + suffix;
  }
  return Math.round(value).toLocaleString('es-PE');
}

function animateStat(el, duration) {
  const target = parseFloat(el.dataset.target);
  const start   = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatStatValue(target * eased, el);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatStatValue(target, el);
  }
  requestAnimationFrame(tick);
}

function animateStats() {
  document.querySelectorAll('.stat-num').forEach((el, i) => {
    setTimeout(() => animateStat(el, 1400), i * 120);
  });
}

function starsHTML(rating) {
  const full = Math.floor(rating);
  const half = (rating - full) >= 0.5;
  let html = '<span class="card-stars">';
  for (let i = 1; i <= 5; i++) {
    let cls = 'star';
    if (i <= full) cls += ' full';
    else if (i === full + 1 && half) cls += ' half';
    html += `<svg class="${cls}" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>`;
  }
  html += `</span><span class="card-stars-num">${rating.toFixed(1)}</span>`;
  return html;
}

function buscar() {
  const raw = document.getElementById('inputUsuario').value.trim().toUpperCase();
  if (!raw) return;
  if (!raw.startsWith('U') || isNaN(raw.slice(1))) {
    alert('Formato: U seguido de número (ej. U18306)');
    return;
  }
  usuarioActual = raw;
  document.getElementById('inputUsuario').value = raw;
  document.getElementById('hero').style.display = 'none';
  document.getElementById('mainContent').classList.add('active');
  ['secComunidad','secBFS','secPD','secHistorial'].forEach(id =>
    document.getElementById(id).style.display = 'none'
  );
  cargarComunidad(raw);
  cargarBFS(raw);
  cargarPD(raw);
  cargarHistorial(raw);
}

function irInicio() {
  usuarioActual = '';
  document.getElementById('inputUsuario').value = '';
  document.getElementById('mainContent').classList.remove('active');
  document.getElementById('hero').style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('inputUsuario').addEventListener('keydown', e => {
  if (e.key === 'Enter') buscar();
});

document.getElementById('logoHome').addEventListener('click', irInicio);
document.getElementById('logoHome').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irInicio(); }
});

document.querySelectorAll('.hero-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('inputUsuario').value = chip.dataset.uid;
    buscar();
  });
});

function fixArticle(title) {
  return title.replace(/^(.*),\s*(The|A|An|Le|Les|La|L'|Der|Die|Das|El|Los|Las|Un|Une|Il|Gli|I|Lo)\s*$/i, '$2 $1').trim();
}

async function getPoster(titulo) {
  if (posterCache[titulo] !== undefined) return posterCache[titulo];
  const matchYear  = titulo.match(/\((\d{4})\)(?:\s*\([^)]*\))*\s*$/);
  const year       = matchYear ? matchYear[1] : '';
  const cleanTitle = fixArticle(titulo
    .replace(/\s*\(\d{4}\).*$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim());
  const url = `/api/tmdb/search?query=${encodeURIComponent(cleanTitle)}${year ? "&year="+year : ""}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const path = data.results?.[0]?.poster_path;
    posterCache[titulo] = path ? IMG_BASE + path : null;
  } catch {
    posterCache[titulo] = null;
  }
  return posterCache[titulo];
}

async function getTMDBDetail(titulo) {
  if (tmdbDetailCache[titulo] !== undefined) return tmdbDetailCache[titulo];
  const matchYear  = titulo.match(/\((\d{4})\)(?:\s*\([^)]*\))*\s*$/);
  const year       = matchYear ? matchYear[1] : '';
  const cleanTitle = fixArticle(titulo
    .replace(/\s*\(\d{4}\).*$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim());
  const searchUrl = `/api/tmdb/search?query=${encodeURIComponent(cleanTitle)}${year ? "&year="+year : ""}`;
  try {
    const res  = await fetch(searchUrl);
    const data = await res.json();
    const movie = data.results?.[0];
    if (!movie) { tmdbDetailCache[titulo] = null; return null; }
    const detailUrl = `/api/tmdb/detail/${movie.id}`;
    const res2  = await fetch(detailUrl);
    const detail = await res2.json();
    const director = detail.credits?.crew?.find(p => p.job === 'Director')?.name || '';
    const cast = detail.credits?.cast?.slice(0, 5).map(p => p.name).join(', ') || '';
    const trailer = detail.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer') || detail.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Teaser');
    const trailerKey = trailer?.key || null;
    const similar = detail.similar?.results?.slice(0, 6).map(m => ({ title: m.title, year: (m.release_date||'').slice(0,4), poster: m.poster_path ? IMG_BASE + m.poster_path : null })) || [];
    const genres = detail.genres?.map(g => g.name).join(', ') || '';
    const result = {
      id: movie.id,
      title: detail.title || cleanTitle,
      year: (detail.release_date || '').slice(0, 4),
      overview: detail.overview || '',
      poster: detail.poster_path ? IMG_BASE_LG + detail.poster_path : null,
      backdrop: detail.backdrop_path ? BACKDROP_BASE + detail.backdrop_path : null,
      rating: detail.vote_average ? detail.vote_average.toFixed(1) : null,
      runtime: detail.runtime || null,
      director,
      cast,
      genres,
      trailerKey,
      similar
    };
    tmdbDetailCache[titulo] = result;
    return result;
  } catch {
    tmdbDetailCache[titulo] = null;
    return null;
  }
}

// ── MODAL ──────────────────────────────────
function createModal() {
  if (document.getElementById('cinexModal')) return;
  const modal = document.createElement('div');
  modal.id = 'cinexModal';
  modal.innerHTML = `
    <div class="modal-overlay" id="modalOverlay"></div>
    <div class="modal-box" id="modalBox">
      <button class="modal-close" id="modalClose">&#x2715;</button>
      <div class="modal-inner" id="modalInner">
        <div class="modal-loading"><span class="spinner"></span></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('modalOverlay').addEventListener('click', closeModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function closeModal() {
  const m = document.getElementById('cinexModal');
  if (m) { m.classList.remove('open'); }
}

async function openMovieModal(titulo) {
  createModal();
  const modal = document.getElementById('cinexModal');
  const inner = document.getElementById('modalInner');
  inner.innerHTML = '<div class="modal-loading"><span class="spinner"></span></div>';
  modal.classList.add('open');
  const d = await getTMDBDetail(titulo);
  if (!d) {
    const cleanT = fixArticle(titulo.replace(/\s*\(\d{4}\).*$/, '').trim());
    const year = (titulo.match(/\((\d{4})\)/) || [])[1] || '';
    inner.innerHTML = `
      <div class="modal-content no-backdrop">
        <div class="modal-poster-col">
          <div class="modal-poster-placeholder"><span>${cleanT}</span></div>
        </div>
        <div class="modal-info-col">
          <h2 class="modal-title">${cleanT} ${year ? '<span class="modal-year">'+year+'</span>' : ''}</h2>
          <p class="modal-overview">No se encontró información adicional en TMDB.</p>
        </div>
      </div>`;
    return;
  }
  inner.innerHTML = `
    ${d.backdrop ? `<div class="modal-backdrop" style="background-image:url('${d.backdrop}')"><div class="modal-backdrop-fade"></div></div>` : ''}
    <div class="modal-content${d.backdrop ? '' : ' no-backdrop'}">
      <div class="modal-poster-col">
        ${d.poster
          ? `<img class="modal-poster" src="${d.poster}" alt="${d.title}">`
          : `<div class="modal-poster-placeholder"><span>${d.title}</span></div>`}
      </div>
      <div class="modal-info-col">
        <h2 class="modal-title">${d.title} ${d.year ? '<span class="modal-year">'+d.year+'</span>' : ''}</h2>
        ${d.genres ? `<div class="modal-genres">${d.genres.split(', ').map(g=>`<span class="modal-genre-chip">${g}</span>`).join('')}</div>` : ''}
        <div class="modal-meta-row">
          ${d.rating ? `<span class="modal-rating">&#9733; ${d.rating}</span>` : ''}
          ${d.runtime ? `<span class="modal-runtime">${d.runtime} min</span>` : ''}
        </div>
        ${d.director ? `<div class="modal-crew"><span class="modal-crew-label">Director</span> ${d.director}</div>` : ''}
        ${d.cast ? `<div class="modal-crew"><span class="modal-crew-label">Reparto</span> ${d.cast}</div>` : ''}
        ${d.overview ? `<p class="modal-overview">${d.overview}</p>` : ''}
        ${d.trailerKey ? `<div class="modal-trailer"><iframe src="https://www.youtube.com/embed/${d.trailerKey}" frameborder="0" allowfullscreen title="Trailer"></iframe></div>` : ''}
      </div>
    </div>
    ${d.similar && d.similar.length ? `
    <div class="modal-similar">
      <h3 class="modal-similar-title">También te puede gustar</h3>
      <div class="modal-similar-grid">
        ${d.similar.map(m => `
          <div class="modal-similar-card" onclick="openMovieModal('${m.title.replace(/'/g,"\\'")} (${m.year})')">
            ${m.poster ? `<img src="${m.poster}" alt="${m.title}">` : `<div class="modal-similar-placeholder">${m.title}</div>`}
            <div class="modal-similar-info"><span>${m.title}</span><span class="modal-year">${m.year}</span></div>
          </div>`).join('')}
      </div>
    </div>` : ''}`;
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

function observeReveal(el) { revealObserver.observe(el); }

function skeletonCard() {
  const div = document.createElement('div');
  div.className = 'movie-card in-view';
  div.innerHTML = `
    <div class="poster-wrap skeleton" style="aspect-ratio:2/3"></div>
    <div class="card-info">
      <div class="skeleton" style="height:13px;border-radius:3px;margin-bottom:8px"></div>
      <div class="skeleton" style="height:10px;width:55%;border-radius:3px"></div>
    </div>`;
  return div;
}

async function renderCard(cardEl, titulo, metaHTML) {
  const poster  = await getPoster(titulo);
  const cleanT  = fixArticle(titulo.replace(/\s*\(\d{4}\).*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim());
  const year    = (titulo.match(/\((\d{4})\)/) || [])[1] || '';
  const yearSpan = year ? `<span class="card-year">(${year})</span>` : '';

  cardEl.classList.remove('in-view');
  cardEl.classList.add('movie-card-rendered');
  cardEl.style.cursor = 'pointer';
  cardEl.addEventListener('click', () => openMovieModal(titulo));

  if (poster) {
    cardEl.innerHTML = `
      <div class="poster-wrap"><img src="${poster}" alt="${cleanT}" loading="lazy"></div>
      <div class="card-info">
        <div class="card-title">${cleanT}${yearSpan}</div>
        <div class="card-meta">${metaHTML}</div>
      </div>`;
  } else {
    cardEl.innerHTML = `
      <div class="poster-wrap"><div class="poster-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F2EFE9" stroke-width="1.2">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5"/>
        </svg>
        <span>${cleanT}</span>
      </div></div>
      <div class="card-info">
        <div class="card-title">${cleanT}${yearSpan}</div>
        <div class="card-meta">${metaHTML}</div>
      </div>`;
  }
  requestAnimationFrame(() => observeReveal(cardEl));
}

function applyDelays(cards) {
  cards.forEach((c, i) => { c.style.transitionDelay = (i * 0.045) + 's'; });
}

function buildSkeletons(grid, n) {
  grid.innerHTML = '';
  const cards = Array.from({ length: n }, () => {
    const s = skeletonCard(); grid.appendChild(s); return s;
  });
  return cards;
}

async function cargarComunidad(uid) {
  const sec  = document.getElementById('secComunidad');
  const grid = document.getElementById('comunidadGrid');
  sec.style.display = 'block';
  grid.innerHTML = `<span class="state-msg"><span class="spinner"></span>Analizando comunidad...</span>`;
  try {
    const res  = await fetch(`/api/comunidad/${uid}`);
    const data = await res.json();
    grid.innerHTML = '';
    if (data.comunidad?.length) {
      const shown = data.comunidad.slice(0, 32);
      shown.forEach(u => {
        const chip = document.createElement('div');
        const esSelf = (u === uid);
        chip.className = 'chip' + (esSelf ? ' self' : '');
        chip.textContent = u;
        if (!esSelf) {
          chip.title = `Ver recomendaciones de ${u}`;
          chip.addEventListener('click', () => {
            document.getElementById('inputUsuario').value = u;
            buscar();
          });
        }
        grid.appendChild(chip);
      });
      if (data.comunidad.length > 32) {
        const more = document.createElement('div');
        more.className = 'chip';
        more.style.opacity = '0.5';
        more.style.cursor = 'default';
        more.textContent = `+${data.comunidad.length - 32} más`;
        grid.appendChild(more);
      }
    } else {
      grid.innerHTML = `<span class="state-msg">${data.mensaje || 'Este usuario no pertenece a ninguna comunidad.'}</span>`;
    }
  } catch {
    grid.innerHTML = `<span class="state-msg">Error al cargar comunidad.</span>`;
  }
}

async function cargarBFS(uid) {
  const sec  = document.getElementById('secBFS');
  const grid = document.getElementById('bfsGrid');
  sec.style.display = 'block';
  buildSkeletons(grid, 12);
  try {
    const res  = await fetch(`/api/bfs/${uid}`);
    const data = await res.json();
    if (!data.length) {
      grid.innerHTML = `<span class="state-msg">Sin recomendaciones BFS para este usuario.</span>`;
      return;
    }
    const items = data.slice(0, 24);
    const cards = buildSkeletons(grid, items.length);
    applyDelays(cards);
    items.forEach((item, i) => renderCard(cards[i], item.titulo, `Distancia ${item.distancia}`));
  } catch {
    grid.innerHTML = `<span class="state-msg">Error al cargar recomendaciones BFS.</span>`;
  }
}

async function cargarPD(uid) {
  const sec  = document.getElementById('secPD');
  const grid = document.getElementById('pdGrid');
  sec.style.display = 'block';
  buildSkeletons(grid, 10);
  try {
    const res  = await fetch(`/api/pd/${uid}`);
    const data = await res.json();
    if (!data.length) {
      grid.innerHTML = `<span class="state-msg">Sin recomendaciones por afinidad. Prueba con U18306.</span>`;
      return;
    }
    const cards = buildSkeletons(grid, data.length);
    applyDelays(cards);
    data.forEach((item, i) => renderCard(cards[i], item.titulo, `Score ${item.score.toFixed(1)}`));
  } catch {
    grid.innerHTML = `<span class="state-msg">Error al cargar recomendaciones por afinidad.</span>`;
  }
}

async function cargarHistorial(uid) {
  const sec  = document.getElementById('secHistorial');
  const grid = document.getElementById('historialGrid');
  sec.style.display = 'block';
  buildSkeletons(grid, 12);
  try {
    const res  = await fetch(`/api/usuario/${uid}/peliculas`);
    const data = await res.json();
    if (!data.length) {
      grid.innerHTML = `<span class="state-msg">Sin historial para este usuario.</span>`;
      return;
    }
    const items = data.slice(0, 24);
    const cards = buildSkeletons(grid, items.length);
    applyDelays(cards);
    items.forEach((item, i) => renderCard(cards[i], item.titulo, starsHTML(item.rating)));
  } catch {
    grid.innerHTML = `<span class="state-msg">Error al cargar historial.</span>`;
  }
}

async function getBackdrop(titulo, anio) {
  const url = `/api/tmdb/search?query=${encodeURIComponent(titulo)}&year=${anio}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const path = data.results?.[0]?.backdrop_path;
    return path ? BACKDROP_BASE + path : null;
  } catch {
    return null;
  }
}

async function initHeroBackdrop() {
  const container = document.getElementById('heroBackdrop');
  if (!container) return;
  const results = await Promise.all(
    HERO_BACKDROP_TITLES.map(item => getBackdrop(item.title, item.year))
  );
  const urls = results.filter(Boolean);
  if (!urls.length) return;
  urls.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    if (i === 0) img.classList.add('active');
    container.appendChild(img);
  });
  if (urls.length < 2) return;
  let current = 0;
  setInterval(() => {
    const imgs = container.querySelectorAll('img');
    imgs[current].classList.remove('active');
    current = (current + 1) % imgs.length;
    imgs[current].classList.add('active');
  }, 7000);
}

initHeroBackdrop();











