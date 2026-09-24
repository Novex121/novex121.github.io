const API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';

const contentContainer = document.getElementById('content-container');
const form = document.getElementById('form');
const search = document.getElementById('search');
const videoModal = document.getElementById('videoModal');
const iframe = document.getElementById('player');
const tvControls = document.getElementById('tvControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
const audioTrackSelect = document.getElementById('audioTrackSelect');
const searchHistoryContainer = document.getElementById('searchHistoryContainer');
const historyChips = document.getElementById('historyChips');

const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroPlayBtn = document.getElementById('hero-play');
const heroFavBtn = document.getElementById('hero-fav-btn');
const installAppBtn = document.getElementById('installAppBtn');

let currentLang = 'en-US';
let currentMedia = { id: null, type: null, isDubbable: false, title: '', poster: '', seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: 'sub' };
let heroSet = false;
let deferredPrompt = null;

// Fallback hardcoded movies/shows in case network blocks API
const FALLBACK_MOVIES = [
  { id: 693134, title: "Dune: Part Two", poster_path: "/8b8R8l88Qje9dn9OE8PY05NxlIF.jpg", backdrop_path: "/xOMo8DxXY7P6n0w6UAM8xPVDZco.jpg", vote_average: 8.2, media_type: "movie" },
  { id: 823464, title: "Godzilla x Kong: The New Empire", poster_path: "/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg", backdrop_path: "/z121dSTR7PY9KxKuvwiIFSYW8cf.jpg", vote_average: 7.2, media_type: "movie" },
  { id: 1011985, title: "Kung Fu Panda 4", poster_path: "/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg", backdrop_path: "/1XDDLuWICNWij8HTvaUJCVPSikH.jpg", vote_average: 7.1, media_type: "movie" },
  { id: 519182, title: "Despicable Me 4", poster_path: "/wWba3TaoZDk7N1T3jHhwKSJSUgE.jpg", backdrop_path: "/lgkPKdgSwz2rC3xX3X0WdD9hN66.jpg", vote_average: 7.3, media_type: "movie" }
];

const FALLBACK_SERIES = [
  { id: 94605, name: "Arcane", poster_path: "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", backdrop_path: "/rkB4LyZxwHNHWPRZZrA5c0l1Q7W.jpg", vote_average: 8.7, media_type: "tv" },
  { id: 1399, name: "Game of Thrones", poster_path: "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", backdrop_path: "/suopoADq0k8YZr4dQXcU6pToj6s.jpg", vote_average: 8.4, media_type: "tv" },
  { id: 66732, name: "Stranger Things", poster_path: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg", backdrop_path: "/56v2KjBlU4XaOv9rVYEQypROD7P.jpg", vote_average: 8.6, media_type: "tv" },
  { id: 85552, name: "Euphoria", poster_path: "/3Q0hd3BjNoj3hI8k156W672yC4S.jpg", backdrop_path: "/o7qi0sSc8xWZzP2G2F6gC7Y0pB5.jpg", vote_average: 8.3, media_type: "tv" }
];

function getWatchlist() { return JSON.parse(localStorage.getItem('novex_watchlist')) || []; }
function saveWatchlist(list) { localStorage.setItem('novex_watchlist', JSON.stringify(list)); }

function getFavorites() { return JSON.parse(localStorage.getItem('novex_favorites')) || []; }
function saveFavorites(list) { localStorage.setItem('novex_favorites', JSON.stringify(list)); }

function getSearchHistory() { return JSON.parse(localStorage.getItem('novex_search_history')) || []; }
function saveSearchHistory(term) {
  let history = getSearchHistory();
  history = history.filter(t => t.toLowerCase() !== term.toLowerCase());
  history.unshift(term);
  if (history.length > 8) history.pop();
  localStorage.setItem('novex_search_history', JSON.stringify(history));
}

function getRatings() { return JSON.parse(localStorage.getItem('novex_ratings')) || {}; }
function saveRating(id, rating) {
  let ratings = getRatings();
  ratings[id] = rating;
  localStorage.setItem('novex_ratings', JSON.stringify(ratings));
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
    if (data && data.results && data.results.length > 0) {
      return data.results;
    }
    throw new Error('Empty results');
  } catch (err) {
    console.warn(`Fetch failed for ${url}, using fallback data.`, err);
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
  loadRecommendationsSection();
}

async function loadOnlyType(type) {
  contentContainer.innerHTML = '';
  heroSet = false;
  hideSearchHistory();
  const urls = getApiUrls(currentLang);

  if (type === 'movie') {
    const movies = await safeFetch(urls.MOVIES_URL, FALLBACK_MOVIES);
    if (movies.length > 0) { setHeroBanner(movies[0], 'movie', false); heroSet = true; }
    renderSection('Trending Movies', movies, 'movie', false);
  } else if (type === 'tv') {
    const series = await safeFetch(urls.SERIES_URL, FALLBACK_SERIES);
    const anime = await safeFetch(urls.ANIME_URL, FALLBACK_SERIES);
    if (series.length > 0) { setHeroBanner(series[0], 'tv', false); heroSet = true; }
    renderSection('Trending TV Series', series, 'tv', false);
    renderSection('Anime (Dub & Sub)', anime, 'tv', true);
  }
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
    updateHeroFavoriteButton();
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

      const badgeText = mediaType === 'tv' ? (isDubbable ? 'Dub/Sub' : 'Series') : 'Movie';

      card.innerHTML = `
        <span class="badge">${badgeText}</span>
        <img src="https://image.tmdb.org/t/p/w300${posterPath}" loading="lazy" alt="${displayTitle}">
        <p>${displayTitle}</p>
      `;
      rowEl.appendChild(card);
    }
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

async function loadRecommendationsSection() {
  const favorites = getFavorites();
  if (favorites.length === 0) return;
  const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
  const recs = await safeFetch(`https://api.themoviedb.org/3/${randomFav.type}/${randomFav.id}/recommendations?api_key=${API_KEY}&language=${currentLang}`, FALLBACK_MOVIES);
  if (recs.length > 0) {
    renderSection(`Because you liked "${randomFav.title}"`, recs, randomFav.type, true);
  }
}

async function openMedia(id, type, isDubbable, title, poster) {
  currentMedia = { id, type, isDubbable, title, poster, seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: audioTrackSelect ? audioTrackSelect.value : 'sub' };

  updateModalActionButtons();
  updateUserRatingDisplay();

  if (type === 'tv' || isDubbable) {
    tvControls.style.display = 'flex';
    if(audioTrackSelect) audioTrackSelect.style.display = isDubbable ? 'inline-block' : 'none';
    seasonSelect.innerHTML = '<option>Loading...</option>';
    episodeSelect.innerHTML = '<option>Loading...</option>';
    videoModal.style.display = 'flex';

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
    videoModal.style.display = 'flex';
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

function onAudioTrackChange() {
  currentMedia.audioType = audioTrackSelect.value;
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
  iframe.src = `https://vidsrc.me/embed/tv?tmdb=${currentMedia.id}&season=${season}&episode=${episode}`;
}

function playNextEpisode() {
  let nextEp = currentMedia.currentEpisode + 1;
  let currentSeasonObj = currentMedia.seasonsData.find(s => s.season_number === currentMedia.currentSeason);
  let maxEpisodes = currentSeasonObj && currentSeasonObj.episode_count ? currentSeasonObj.episode_count : 24;

  if (nextEp > maxEpisodes) {
    let nextSeasonNum = currentMedia.currentSeason + 1;
    let nextSeasonObj = currentMedia.seasonsData.find(s => s.season_number === nextSeasonNum);
    if (nextSeasonObj) {
      currentMedia.currentSeason = nextSeasonNum;
      seasonSelect.value = nextSeasonNum;
      updateEpisodeDropdown();
      nextEp = 1;
    } else { return; }
  }

  currentMedia.currentEpisode = nextEp;
  episodeSelect.value = nextEp;
  updatePlayerUrl(currentMedia.currentSeason, nextEp);
}

function closePlayer() {
  iframe.src = '';
  videoModal.style.display = 'none';
}

function toggleCurrentFavorite() {
  let favs = getFavorites();
  const index = favs.findIndex(f => f.id === currentMedia.id);
  if (index > -1) favs.splice(index, 1);
  else favs.push({ id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster });
  saveFavorites(favs);
  updateModalActionButtons();
  updateHeroFavoriteButton();
}

function toggleHeroFavorite() {
  if (!currentMedia.heroItem) return;
  let favs = getFavorites();
  const index = favs.findIndex(f => f.id === currentMedia.heroItem.id);
  if (index > -1) favs.splice(index, 1);
  else favs.push(currentMedia.heroItem);
  saveFavorites(favs);
  updateHeroFavoriteButton();
}

function updateHeroFavoriteButton() {
  if (!currentMedia.heroItem || !heroFavBtn) return;
  const favs = getFavorites();
  const exists = favs.some(f => f.id === currentMedia.heroItem.id);
  heroFavBtn.innerHTML = exists ? '<i class="fa-solid fa-heart" style="color:var(--accent-red);"></i>' : '<i class="fa-regular fa-heart"></i>';
}

function toggleCurrentWatchlist() {
  let watchlist = getWatchlist();
  const index = watchlist.findIndex(w => w.id === currentMedia.id);
  if (index > -1) watchlist.splice(index, 1);
  else watchlist.push({ id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster });
  saveWatchlist(watchlist);
  updateModalActionButtons();
}

function updateModalActionButtons() {
  const favs = getFavorites();
  const watchlist = getWatchlist();
  const modalFavBtn = document.getElementById('modalFavBtn');
  const modalWatchlistBtn = document.getElementById('modalWatchlistBtn');

  if (modalFavBtn) modalFavBtn.style.color = favs.some(f => f.id === currentMedia.id) ? 'var(--accent-red)' : 'white';
  if (modalWatchlistBtn) modalWatchlistBtn.style.color = watchlist.some(w => w.id === currentMedia.id) ? 'var(--accent-red)' : 'white';
}

function rateCurrentMedia(score) {
  saveRating(currentMedia.id, score);
  updateUserRatingDisplay();
}

function updateUserRatingDisplay() {
  const ratings = getRatings();
  const display = document.getElementById('userRatingDisplay');
  if (display) {
    const score = ratings[currentMedia.id];
    display.textContent = score ? `(${score}/5)` : '(-/5)';
  }
}

function loadWatchlist() {
  contentContainer.innerHTML = '';
  hideSearchHistory();
  renderCustomGrid('My Watchlist', getWatchlist());
}

function loadFavorites() {
  contentContainer.innerHTML = '';
  hideSearchHistory();
  renderCustomGrid('My Favorites', getFavorites());
}

function loadUserProfile() {
  contentContainer.innerHTML = `
    <div style="padding: 20px;">
      <h2>My Profile & Statistics</h2>
      <p style="color:var(--text-muted); margin-top: 10px;">Watchlist Items: ${getWatchlist().length}</p>
      <p style="color:var(--text-muted); margin-top: 5px;">Favorite Items: ${getFavorites().length}</p>
      <p style="color:var(--text-muted); margin-top: 5px;">Rated Titles: ${Object.keys(getRatings()).length}</p>
    </div>
  `;
  hideSearchHistory();
}

function renderCustomGrid(title, items) {
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
    card.onclick = () => openMedia(item.id, item.type, true, item.title || item.name, item.poster_path || item.poster);
    card.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${item.poster_path || item.poster}" loading="lazy" alt="${item.title || item.name}">
      <p>${item.title || item.name}</p>
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

// PWA Install Prompt Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn) installAppBtn.style.display = 'flex';
});

async function triggerInstallPrompt() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (installAppBtn) installAppBtn.style.display = 'none';
  } else {
    alert("To install this app on your device, use your browser menu and select 'Add to Home Screen' or 'Install App'.");
  }
}

window.addEventListener('appinstalled', () => {
  if (installAppBtn) installAppBtn.style.display = 'none';
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

document.addEventListener('DOMContentLoaded', loadAllCatalog);