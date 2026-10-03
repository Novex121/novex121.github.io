const API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';

const contentContainer = document.getElementById('content-container');
const form = document.getElementById('form');
const search = document.getElementById('search');
const videoModal = document.getElementById('videoModal');
const iframe = document.getElementById('player');
const tvControls = document.getElementById('tvControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
const audioLangSelect = document.getElementById('audioLangSelect');
const searchHistoryContainer = document.getElementById('searchHistoryContainer');
const historyChips = document.getElementById('historyChips');
const installAppBtn = document.getElementById('installAppBtn');

const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroPlayBtn = document.getElementById('hero-play');
const heroWatchlistBtn = document.getElementById('hero-watchlist');

let currentLang = 'en-US';
let currentMedia = { id: null, type: null, isDubbable: false, title: '', poster: '', seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: 'sub' };
let deferredPrompt = null;
let heroItemsList = [];
let heroSlideIndex = 0;
let heroInterval = null;

// PWA Install Prompt Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn) installAppBtn.style.display = 'block';
});

async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      if (installAppBtn) installAppBtn.style.display = 'none';
    }
    deferredPrompt = null;
  }
}

// IndexedDB Setup for Offline Downloads, Watchlist, & Favorites
const DB_NAME = 'NovexAppDB';
const STORE_DOWNLOADS = 'downloads';
const STORE_WATCHLIST = 'watchlist';
const STORE_FAVORITES = 'favorites';

function openAppDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) db.createObjectStore(STORE_DOWNLOADS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_WATCHLIST)) db.createObjectStore(STORE_WATCHLIST, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
    };
  });
}

async function dbItemAction(storeName, item, action = 'put') {
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = action === 'put' ? store.put(item) : store.delete(item);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openAppDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbExists(storeName, id) {
  const all = await dbGetAll(storeName);
  return all.some(item => item.id === id);
}

// Fallback data (including Resident Evil themed or similar popular series/movies/anime)
const FALLBACK_MEDIA = [
  { id: 109617, name: "Resident Evil: Infinite Darkness", poster_path: "/g8aKx987l2bK0sI4k64xL59g5b.jpg", backdrop_path: "/u9YEh2xVAPrtKoaMNllkPrtCs6s.jpg", vote_average: 7.3, media_type: "tv", original_language: "ja" },
  { id: 693134, title: "Dune: Part Two", poster_path: "/8b8R8l88Qje9dn9OE8PY05NxlIF.jpg", backdrop_path: "/xOMo8DxXY7P6n0w6UAM8xPVDZco.jpg", vote_average: 8.2, media_type: "movie" },
  { id: 94605, name: "Arcane", poster_path: "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", backdrop_path: "/rkB4LyZxwHNHWPRZZrA5c0l1Q7W.jpg", vote_average: 8.7, media_type: "tv", original_language: "en" }
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
    TRENDING_ALL: `https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=${lang}`,
    MOVIES_URL: `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=${lang}`,
    SERIES_URL: `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&language=${lang}`,
    ANIME_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=${lang}`,
    KDRAMA_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=ko&sort_by=popularity.desc&language=${lang}`,
    CDRAMA_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_original_language=zh&sort_by=popularity.desc&language=${lang}`,
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
  hideSearchHistory();
  const urls = getApiUrls(currentLang);

  const trendingAll = await safeFetch(urls.TRENDING_ALL, FALLBACK_MEDIA);
  const movies = await safeFetch(urls.MOVIES_URL, FALLBACK_MEDIA);
  const series = await safeFetch(urls.SERIES_URL, FALLBACK_MEDIA);
  const anime = await safeFetch(urls.ANIME_URL, FALLBACK_MEDIA);
  const kdrama = await safeFetch(urls.KDRAMA_URL, FALLBACK_MEDIA);
  const cdrama = await safeFetch(urls.CDRAMA_URL, FALLBACK_MEDIA);

  // Setup Auto-sliding Hero (includes Resident Evil / TV / Anime / Movies)
  heroItemsList = trendingAll.slice(0, 6);
  if (heroItemsList.length > 0) {
    startHeroSlider();
  }

  renderSection('Trending All (Series, Movies & Anime)', trendingAll, 'tv', true);
  renderSection('Trending Movies', movies, 'movie', false);
  renderSection('Trending TV Series', series, 'tv', false);
  renderSection('Anime (Dub & Sub Selector)', anime, 'tv', true);
  renderSection('K-Dramas (Dub & Sub Selector)', kdrama, 'tv', true);
  renderSection('C-Dramas (Dub & Sub Selector)', cdrama, 'tv', true);
  
  // Smart Recommendations Section based on interaction
  renderSmartRecommendations();
}

function startHeroSlider() {
  if (heroInterval) clearInterval(heroInterval);
  heroSlideIndex = 0;
  updateHeroBanner(heroItemsList[heroSlideIndex]);

  heroInterval = setInterval(() => {
    heroSlideIndex = (heroSlideIndex + 1) % heroItemsList.length;
    updateHeroBanner(heroItemsList[heroSlideIndex]);
  }, 10000); // changes every 10 seconds
}

function updateHeroBanner(item) {
  const displayTitle = item.title || item.name || item.original_name;
  const mediaType = getMediaType(item, 'tv');
  const backdropPath = item.backdrop_path || item.poster_path;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.0';
  const isDubbable = mediaType === 'tv' || ['ja', 'ko', 'zh'].includes(item.original_language);
  
  currentMedia.heroItem = { id: item.id, type: mediaType, isDubbable, title: displayTitle, poster: item.poster_path };

  if (backdropPath && heroBanner) {
    heroBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${backdropPath})`;
  }
  if (heroTitle) heroTitle.textContent = displayTitle;
  if (heroMeta) heroMeta.textContent = `⭐ ${rating} | ${mediaType === 'tv' ? 'Series / Anime' : 'Movie'} (${isDubbable ? 'Sub & Dub' : 'Sub'})`;
  if (heroPlayBtn) heroPlayBtn.onclick = () => openMedia(item.id, mediaType, isDubbable, displayTitle, item.poster_path);
  if (heroWatchlistBtn) heroWatchlistBtn.onclick = () => toggleQuickWatchlist(item);
}

async function toggleQuickWatchlist(item) {
  const id = item.id;
  const title = item.title || item.name;
  const type = getMediaType(item, 'tv');
  const exists = await dbExists(STORE_WATCHLIST, id);
  if (exists) {
    await dbItemAction(STORE_WATCHLIST, id, 'delete');
    alert(`Removed "${title}" from Watchlist.`);
  } else {
    await dbItemAction(STORE_WATCHLIST, { id, type, title, poster: item.poster_path }, 'put');
    alert(`Added "${title}" to Watchlist!`);
  }
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
      const isDubbable = isDubbableSection || mediaType === 'tv' || ['ja', 'ko', 'zh'].includes(item.original_language);
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

async function renderSmartRecommendations() {
  const watchlist = await dbGetAll(STORE_WATCHLIST);
  const favorites = await dbGetAll(STORE_FAVORITES);
  if (watchlist.length === 0 && favorites.length === 0) return;

  const sampleItem = watchlist[0] || favorites[0];
  const urls = getApiUrls(currentLang);
  const similar = await safeFetch(`https://api.themoviedb.org/3/${sampleItem.type}/${sampleItem.id}/similar?api_key=${API_KEY}&language=${currentLang}`, FALLBACK_MEDIA);

  if (similar.length > 0) {
    renderSection(`Recommended For You (Based on "${sampleItem.title}")`, similar, sampleItem.type, true);
  }
}

async function openMedia(id, type, isDubbable, title, poster) {
  if (heroInterval) clearInterval(heroInterval); // pause banner slider while watching
  currentMedia = { id, type, isDubbable, title, poster, seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: 'sub' };

  await updateModalActionButtons();
  videoModal.style.display = 'flex';

  if (videoModal.requestFullscreen) {
    videoModal.requestFullscreen().catch(err => console.log(err));
  } else if (videoModal.webkitRequestFullscreen) {
    videoModal.webkitRequestFullscreen();
  }

  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(err => console.log(err));
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
  startHeroSlider(); // resume hero banner

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(err => console.log(err));
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

function onAudioLangChange() {
  currentMedia.audioType = audioLangSelect.value;
  updatePlayerUrl(currentMedia.currentSeason, currentMedia.currentEpisode);
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
  if (currentMedia.type === 'tv' || currentMedia.isDubbable) {
    // Supports sub/dub routing embed configuration
    const dubParam = currentMedia.audioType === 'dub' ? '&ds=dub' : '';
    iframe.src = `https://vidsrc.me/embed/tv?tmdb=${currentMedia.id}&season=${season}&episode=${episode}${dubParam}`;
  } else {
    iframe.src = `https://vidsrc.me/embed/movie?tmdb=${currentMedia.id}`;
  }
}

// Modal Action Handlers (Downloads, Favorites, Watchlist)
async function toggleAppDownload() {
  const isDownloaded = await dbExists(STORE_DOWNLOADS, currentMedia.id);
  if (isDownloaded) {
    await dbItemAction(STORE_DOWNLOADS, currentMedia.id, 'delete');
    alert(`"${currentMedia.title}" removed from offline downloads.`);
  } else {
    await dbItemAction(STORE_DOWNLOADS, { id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster }, 'put');
    alert(`"${currentMedia.title}" successfully downloaded for offline viewing!`);
  }
  await updateModalActionButtons();
}

async function toggleFavorite() {
  const isFav = await dbExists(STORE_FAVORITES, currentMedia.id);
  if (isFav) {
    await dbItemAction(STORE_FAVORITES, currentMedia.id, 'delete');
    alert(`Removed from Favorites.`);
  } else {
    await dbItemAction(STORE_FAVORITES, { id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster }, 'put');
    alert(`Added to Favorites!`);
  }
  await updateModalActionButtons();
}

async function toggleWatchlist() {
  const isWatch = await dbExists(STORE_WATCHLIST, currentMedia.id);
  if (isWatch) {
    await dbItemAction(STORE_WATCHLIST, currentMedia.id, 'delete');
    alert(`Removed from Watchlist.`);
  } else {
    await dbItemAction(STORE_WATCHLIST, { id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster }, 'put');
    alert(`Added to Watchlist!`);
  }
  await updateModalActionButtons();
}

async function updateModalActionButtons() {
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
  const modalWatchlistBtn = document.getElementById('modalWatchlistBtn');

  if (modalDownloadBtn) modalDownloadBtn.style.color = (await dbExists(STORE_DOWNLOADS, currentMedia.id)) ? 'var(--accent-red)' : 'white';
  if (modalFavoriteBtn) modalFavoriteBtn.style.color = (await dbExists(STORE_FAVORITES, currentMedia.id)) ? 'var(--accent-red)' : 'white';
  if (modalWatchlistBtn) modalWatchlistBtn.style.color = (await dbExists(STORE_WATCHLIST, currentMedia.id)) ? 'var(--accent-red)' : 'white';
}

// Library View Renderers
async function loadDownloads() {
  if (heroInterval) clearInterval(heroInterval);
  contentContainer.innerHTML = '';
  hideSearchHistory();
  const downloads = await dbGetAll(STORE_DOWNLOADS);
  renderLibraryView('My Offline Downloads', downloads);
}

async function loadFavorites() {
  if (heroInterval) clearInterval(heroInterval);
  contentContainer.innerHTML = '';
  hideSearchHistory();
  const favorites = await dbGetAll(STORE_FAVORITES);
  renderLibraryView('My Favorites', favorites);
}

async function loadWatchlist() {
  if (heroInterval) clearInterval(heroInterval);
  contentContainer.innerHTML = '';
  hideSearchHistory();
  const watchlist = await dbGetAll(STORE_WATCHLIST);
  renderLibraryView('My Watchlist', watchlist);
}

function renderLibraryView(title, items) {
  const sectionEl = document.createElement('div');
  sectionEl.classList.add('media-row-section');
  sectionEl.innerHTML = `<div class="section-header"><h2>${title}</h2></div>`;

  if (items.length === 0) {
    sectionEl.innerHTML += `<p style="padding: 15px; color: var(--text-muted);">No items found here yet.</p>`;
    contentContainer.appendChild(sectionEl);
    return;
  }

  const rowEl = document.createElement('div');
  rowEl.classList.add('horizontal-scroll-row');

  items.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('media-card');
    card.onclick = () => openMedia(item.id, item.type, true, item.title, item.poster);
    card.innerHTML = `
      <span class="badge">Saved</span>
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
  if (heroInterval) clearInterval(heroInterval);
  contentContainer.innerHTML = '';
  hideSearchHistory();
  saveSearchHistory(searchTerm);

  const urls = getApiUrls(currentLang);
  const results = await safeFetch(urls.SEARCH_API + encodeURIComponent(searchTerm), FALLBACK_MEDIA);
  const validMedia = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  
  if (validMedia.length > 0) {
      renderSection(`Search Results for "${searchTerm}"`, validMedia, 'movie', true);
  } else {
      contentContainer.innerHTML = `<h2 style="padding: 20px;">No results found for "${searchTerm}"</h2>`;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
  });
}
