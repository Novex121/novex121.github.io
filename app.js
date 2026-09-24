const API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';

const contentContainer = document.getElementById('content-container');
const form = document.getElementById('form');
const search = document.getElementById('search');
const videoModal = document.getElementById('videoModal');
const iframe = document.getElementById('player');
const tvControls = document.getElementById('tvControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
const searchHistoryContainer = document.getElementById('searchHistoryContainer');
const historyChips = document.getElementById('historyChips');

const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroPlayBtn = document.getElementById('hero-play');

let currentLang = 'en-US';
let currentMedia = { id: null, type: null, isDubbable: false, title: '', poster: '', seasonsData: [], currentSeason: 1, currentEpisode: 1 };
let heroSet = false;

// IndexedDB Setup for In-App Secure Sandbox Downloads
const DB_NAME = 'NovexDownloadsDB';
const STORE_NAME = 'downloads';

function openDownloadsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveDownloadToApp(item) {
  const db = await openDownloadsDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function getAppDownloads() {
  const db = await openDownloadsDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeAppDownload(id) {
  const db = await openDownloadsDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function isDownloadedInApp(id) {
  const downloads = await getAppDownloads();
  return downloads.some(d => d.id === id);
}

// Fallback data
const FALLBACK_MOVIES = [
  { id: 693134, title: "Dune: Part Two", poster_path: "/8b8R8l88Qje9dn9OE8PY05NxlIF.jpg", backdrop_path: "/xOMo8DxXY7P6n0w6UAM8xPVDZco.jpg", vote_average: 8.2, media_type: "movie" },
  { id: 823464, title: "Godzilla x Kong: The New Empire", poster_path: "/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg", backdrop_path: "/z121dSTR7PY9KxKuvwiIFSYW8cf.jpg", vote_average: 7.2, media_type: "movie" }
];

const FALLBACK_SERIES = [
  { id: 94605, name: "Arcane", poster_path: "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", backdrop_path: "/rkB4LyZxwHNHWPRZZrA5c0l1Q7W.jpg", vote_average: 8.7, media_type: "tv" },
  { id: 1399, name: "Game of Thrones", poster_path: "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", backdrop_path: "/suopoADq0k8YZr4dQXcU6pToj6s.jpg", vote_average: 8.4, media_type: "tv" }
];

function getSearchHistory() { return JSON.parse(localStorage.getItem('novex_search_history')) || []; }
function saveSearchHistory(term) {
  let history = getSearchHistory();
  history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
  history.unshift(term);
  if (history.length > 8) history.pop();
  localStorage.setItem('novex_search_history', JSON.stringify(history));
}

function getApiUrls(lang) {
  return {
    MOVIES_URL: `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=${lang}`,
    SERIES_URL: `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&language=${lang}`,
    ANIME_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=${lang}`,
    KDRAMA_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=ko&sort_by=popularity.desc&language=${lang}`,
    SEARCH_API: `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=${lang}&query=`
  };
}

function getMediaType(item, defaultType) {
  if (item.media_type) return item.media_type;
  if (defaultType) return defaultType;
  if (item.name && !item.title) return 'tv';
  return 'movie';
}

async function safeFetch(url, fallbackData) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (data && data.results && data.results.length > 0) return data.results;
    throw new Error('Empty results');
  } catch (err) {
    return fallbackData;
  }
}

async function loadAllCatalog() {
  contentContainer.innerHTML = '';
  heroSet = false;
  hideSearchHistory();
  const urls = getApiUrls(currentLang);

  const movies = await safeFetch(urls.MOVIES_URL, FALLBACK_MOVIES);
  const series = await safeFetch(urls.SERIES_URL, FALLBACK_SERIES);
  const anime = await safeFetch(urls.ANIME_URL, FALLBACK_SERIES);
  const kdrama = await safeFetch(urls.KDRAMA_URL, FALLBACK_SERIES);

  if (movies.length > 0) {
    setHeroBanner(movies[0], 'movie', false);
    heroSet = true;
  }

  renderSection('Trending Movies', movies, 'movie', false);
  renderSection('Trending TV Series', series, 'tv', false);
  renderSection('Anime (Dub & Sub)', anime, 'tv', true);
  renderSection('K-Dramas & Asian Series', kdrama, 'tv', true);
}

function setHeroBanner(item, defaultType, isDubbableSection) {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const backdropPath = item.backdrop_path || item.poster_path;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.0';
    const isDubbable = isDubbableSection || (item.genre_ids && item.genre_ids.includes(16)) || ['ja', 'ko', 'zh'].includes(item.original_language);
    
    currentMedia.heroItem = { id: item.id, type: mediaType, isDubbable, title: displayTitle, poster: item.poster_path };

    if (backdropPath && heroBanner) {
        heroBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${backdropPath})`;
    }
    if (heroTitle) heroTitle.textContent = displayTitle;
    if (heroMeta) heroMeta.textContent = `⭐ ${rating} | ${isDubbable ? 'Dub/Sub Available' : (mediaType === 'tv' ? 'Series' : 'Movie')}`;
    if (heroPlayBtn) heroPlayBtn.onclick = () => openMedia(item.id, mediaType, isDubbable, displayTitle, item.poster_path);
}

function renderSection(sectionTitle, items, defaultType = 'movie', isDubbableSection = false) {
  const sectionEl = document.createElement('div');
  sectionEl.classList.add('media-row-section');

  const headerDiv = document.createElement('div');
  headerDiv.classList.add('section-header');

  const titleEl = document.createElement('h2');
  titleEl.textContent = sectionTitle;
  headerDiv.appendChild(titleEl);
  sectionEl.appendChild(headerDiv);

  const rowEl = document.createElement('div');
  rowEl.classList.add('horizontal-scroll-row');

  items.forEach(item => {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const posterPath = item.poster_path;

    if (posterPath && displayTitle) {
      const card = document.createElement('div');
      card.classList.add('media-card');
      const isDubbable = isDubbableSection || (item.genre_ids && item.genre_ids.includes(16)) || ['ja', 'ko', 'zh'].includes(item.original_language);
      card.onclick = () => openMedia(item.id, mediaType, isDubbable, displayTitle, posterPath);

      card.innerHTML = `
        <span class="badge">${mediaType === 'tv' ? 'Series' : 'Movie'}</span>
        <img src="https://image.tmdb.org/t/p/w300${posterPath}" loading="lazy" alt="${displayTitle}">
        <p>${displayTitle}</p>
      `;
      rowEl.appendChild(card);
    }
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

async function openMedia(id, type, isDubbable, title, poster) {
  currentMedia = { id, type, isDubbable, title, poster, seasonsData: [], currentSeason: 1, currentEpisode: 1 };

  await updateModalActionButtons();

  // Show Modal & Force Fullscreen Landscape Mode
  videoModal.style.display = 'flex';

  if (videoModal.requestFullscreen) {
    videoModal.requestFullscreen().catch(err => console.log("Fullscreen request note:", err));
  } else if (videoModal.webkitRequestFullscreen) {
    videoModal.webkitRequestFullscreen();
  }

  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(err => console.log('Orientation lock note:', err));
  }

  if (type === 'tv' || isDubbable) {
    tvControls.style.display = 'flex';
    seasonSelect.innerHTML = '<option>Loading...</option>';
    episodeSelect.innerHTML = '<option>Loading...</option>';

    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&language=${currentLang}`);
      const data = await res.json();
      let validSeasons = (data.seasons || []).filter(s => s.season_number > 0);
      if (validSeasons.length === 0 && data.seasons) { validSeasons = data.seasons; }

      currentMedia.seasonsData = validSeasons;
      populateSeasonDropdown(validSeasons);
      updateEpisodesAndPlay();
    } catch (err) {
      populateFallbackDropdowns();
      updatePlayerUrl(1, 1);
    }
  } else {
    tvControls.style.display = 'none';
    iframe.src = `https://vidsrc.me/embed/movie?tmdb=${id}`;
  }
}

function closePlayer() {
  iframe.src = '';
  videoModal.style.display = 'none';

  // Exit Fullscreen & Unlock Orientation
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(err => console.log("Exit fullscreen note:", err));
  }
  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock();
  }
}

function populateSeasonDropdown(seasons) {
  seasonSelect.innerHTML = '';
  if (seasons.length === 0) {
    seasonSelect.innerHTML = '<option value="1">Season 1</option>';
    return;
  }
  seasons.forEach(s => {
    seasonSelect.innerHTML += `<option value="${s.season_number}">${s.name || `Season ${s.season_number}`}</option>`;
  });
}

function onSeasonChange() {
  updateEpisodeDropdown();
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  currentMedia.currentSeason = selectedSeason;
  currentMedia.currentEpisode = 1;
  if(episodeSelect.options.length > 0) episodeSelect.value = "1";
  updatePlayerUrl(selectedSeason, 1);
}

function onEpisodeChange() {
  updatePlayerUrl(parseInt(seasonSelect.value) || 1, parseInt(episodeSelect.value) || 1);
}

function updateEpisodesAndPlay() {
  updateEpisodeDropdown();
  updatePlayerUrl(parseInt(seasonSelect.value) || 1, 1);
}

function updateEpisodeDropdown() {
  episodeSelect.innerHTML = '';
  const selectedSeasonNumber = parseInt(seasonSelect.value) || 1;
  const seasonObj = currentMedia.seasonsData.find(s => s.season_number === selectedSeasonNumber);
  const count = seasonObj && seasonObj.episode_count ? seasonObj.episode_count : 24;

  for (let i = 1; i <= count; i++) {
    episodeSelect.innerHTML += `<option value="${i}">Episode ${i}</option>`;
  }
}

function populateFallbackDropdowns() {
  seasonSelect.innerHTML = '';
  for (let s = 1; s <= 5; s++) seasonSelect.innerHTML += `<option value="${s}">Season ${s}</option>`;
  episodeSelect.innerHTML = '';
  for (let e = 1; e <= 24; e++) episodeSelect.innerHTML += `<option value="${e}">Episode ${e}</option>`;
}

function updatePlayerUrl(season, episode) {
  currentMedia.currentSeason = season;
  currentMedia.currentEpisode = episode;
  iframe.src = `https://vidsrc.me/embed/tv?tmdb=${currentMedia.id}&season=${season}&episode=${episode}`;
}

// In-App Sandbox Download Handler
async function toggleAppDownload() {
  const isDownloaded = await isDownloadedInApp(currentMedia.id);
  if (isDownloaded) {
    await removeAppDownload(currentMedia.id);
    alert(`"${currentMedia.title}" removed from app downloads.`);
  } else {
    await saveDownloadToApp({
      id: currentMedia.id,
      type: currentMedia.type,
      title: currentMedia.title,
      poster: currentMedia.poster,
      downloadedAt: new Date().toISOString()
    });
    alert(`"${currentMedia.title}" successfully downloaded to app storage! Check your Downloads section.`);
  }
  await updateModalActionButtons();
}

async function updateModalActionButtons() {
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  if (modalDownloadBtn) {
    const downloaded = await isDownloadedInApp(currentMedia.id);
    modalDownloadBtn.style.color = downloaded ? 'var(--accent-red)' : 'white';
  }
}

async function loadDownloads() {
  contentContainer.innerHTML = '';
  hideSearchHistory();
  const downloads = await getAppDownloads();

  const sectionEl = document.createElement('div');
  sectionEl.classList.add('media-row-section');
  sectionEl.innerHTML = `<div class="section-header"><h2>My App Downloads (Offline Ready)</h2></div>`;

  if (downloads.length === 0) {
    sectionEl.innerHTML += `<p style="padding: 15px; color: var(--text-muted);">No titles downloaded to app storage yet. Tap the download icon while viewing any movie or series.</p>`;
    contentContainer.appendChild(sectionEl);
    return;
  }

  const rowEl = document.createElement('div');
  rowEl.classList.add('horizontal-scroll-row');

  downloads.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('media-card');
    card.onclick = () => openMedia(item.id, item.type, true, item.title, item.poster);
    card.innerHTML = `
      <span class="badge">Downloaded</span>
      <img src="https://image.tmdb.org/t/p/w300${item.poster}" loading="lazy" alt="${item.title}">
      <p>${item.title}</p>
    `;
    rowEl.appendChild(card);
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

function showSearchHistory() {
  const history = getSearchHistory();
  if (history.length > 0 && searchHistoryContainer) {
    searchHistoryContainer.style.display = 'block';
    historyChips.innerHTML = '';
    history.forEach(term => {
      const chip = document.createElement('span');
      chip.classList.add('search-chip');
      chip.textContent = term;
      chip.onclick = () => { search.value = term; executeSearch(term); };
      historyChips.appendChild(chip);
    });
  }
}

function hideSearchHistory() {
  if (searchHistoryContainer) searchHistoryContainer.style.display = 'none';
}

if (search) search.addEventListener('focus', showSearchHistory);

async function executeSearch(searchTerm) {
  contentContainer.innerHTML = '';
  heroSet = false;
  hideSearchHistory();
  saveSearchHistory(searchTerm);

  const urls = getApiUrls(currentLang);
  const results = await safeFetch(urls.SEARCH_API + encodeURIComponent(searchTerm), FALLBACK_MOVIES);
  const validMedia = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  
  if (validMedia.length > 0) {
      setHeroBanner(validMedia[0], validMedia[0].media_type, false);
      heroSet = true;
      renderSection(`Search Results for "${searchTerm}"`, validMedia, 'movie', false);
  } else {
      contentContent.innerHTML = `<h2 style="padding: 20px;">No results found for "${searchTerm}"</h2>`;
  }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const searchTerm = search.value.trim();
    if (searchTerm) executeSearch(searchTerm);
    else loadAllCatalog();
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

document.addEventListener('DOMContentLoaded', loadAllCatalog);
