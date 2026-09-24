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

let currentLang = localStorage.getItem('novex_lang') || 'en-US';
let currentMedia = { id: null, type: null, isDubbable: false, title: '', poster: '', seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: 'sub' };
let heroSet = false;

// LocalStorage Persistence Helpers
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

async function loadAllCatalog() {
  contentContainer.innerHTML = '';
  heroSet = false;
  setActiveNav(0);
  hideSearchHistory();
  const urls = getApiUrls(currentLang);
  
  await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie', false);
  await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv', false);
  await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv', true);
  await fetchAndRenderSection(urls.KDRAMA_URL, 'K-Dramas & Asian Series', 'tv', true);
  await fetchAndRenderSection(urls.CDRAMA_URL, 'C-Dramas', 'tv', true);
  loadRecommendationsSection();
}

async function loadOnlyType(type) {
  contentContainer.innerHTML = '';
  heroSet = false;
  hideSearchHistory();
  const urls = getApiUrls(currentLang);
  
  if (type === 'movie') {
      setActiveNav(0);
      await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie', false);
  } else if (type === 'tv') {
      setActiveNav(0);
      await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv', false);
      await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv', true);
      await fetchAndRenderSection(urls.KDRAMA_URL, 'K-Dramas & Asian Series', 'tv', true);
  }
}

function setActiveNav(index) {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
}

async function fetchAndRenderSection(url, title, defaultType, isDubbableSection) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      if (!heroSet) {
          setHeroBanner(data.results[0], defaultType, isDubbableSection);
          heroSet = true;
      }
      renderSection(title, data.results, defaultType, isDubbableSection);
    }
  } catch (error) {
    console.error(`Error fetching ${title}:`, error);
  }
}

function setHeroBanner(item, defaultType, isDubbableSection) {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const backdropPath = item.backdrop_path || item.poster_path;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
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

// Recommendations based on recent Watchlist / Favorites
async function loadRecommendationsSection() {
  const favorites = getFavorites();
  if (favorites.length === 0) return;

  const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${randomFav.type}/${randomFav.id}/recommendations?api_key=${API_KEY}&language=${currentLang}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      renderSection(`Because you liked "${randomFav.title}"`, data.results, randomFav.type, true);
    }
  } catch (err) {
    console.error("Recommendations error:", err);
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
      console.error("TV Metadata error:", err);
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
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  const selectedEpisode = parseInt(episodeSelect.value) || 1;
  updatePlayerUrl(selectedSeason, selectedEpisode);
}

function onAudioTrackChange() {
  currentMedia.audioType = audioTrackSelect.value;
  updatePlayerUrl(currentMedia.currentSeason, currentMedia.currentEpisode);
}

function updateEpisodesAndPlay() {
  updateEpisodeDropdown();
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  const selectedEpisode = 1;
  updatePlayerUrl(selectedSeason, selectedEpisode);
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
    } else {
      return; 
    }
  }

  currentMedia.currentEpisode = nextEp;
  episodeSelect.value = nextEp;
  updatePlayerUrl(currentMedia.currentSeason, nextEp);
}

function closePlayer() {
  iframe.src = '';
  videoModal.style.display = 'none';
}

// Watchlist, Favorites & Ratings Handlers
function toggleCurrentFavorite() {
  let favs = getFavorites();
  const index = favs.findIndex(f => f.id === currentMedia.id);
  if (index > -1) {
    favs.splice(index, 1);
  } else {
    favs.push({ id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster });
  }
  saveFavorites(favs);
  updateModalActionButtons();
  updateHeroFavoriteButton();
}

function toggleHeroFavorite() {
  if (!currentMedia.heroItem) return;
  let favs = getFavorites();
  const index = favs.findIndex(f => f.id === currentMedia.heroItem.id);
  if (index > -1) {
    favs.splice(index, 1);
  } else {
    favs.push(currentMedia.heroItem);
  }
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
  if (index > -1) {
    watchlist.splice(index, 1);
  } else {
    watchlist.push({ id: currentMedia.id, type: currentMedia.type, title: currentMedia.title, poster: currentMedia.poster });
  }
  saveWatchlist(watchlist);
  updateModalActionButtons();
}

function updateModalActionButtons() {
  const favs = getFavorites();
  const watchlist = getWatchlist();
  
  const modalFavBtn = document.getElementById('modalFavBtn');
  const modalWatchlistBtn = document.getElementById('modalWatchlistBtn');

  if (modalFavBtn) {
    const isFav = favs.some(f => f.id === currentMedia.id);
    modalFavBtn.style.color = isFav ? 'var(--accent-red)' : 'white';
  }
  if (modalWatchlistBtn) {
    const isWl = watchlist.some(w => w.id === currentMedia.id);
    modalWatchlistBtn.style.color = isWl ? 'var(--accent-red)' : 'white';
  }
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
  const watchlist = getWatchlist();
  renderCustomGrid('My Watchlist', watchlist);
}

function loadFavorites() {
  contentContainer.innerHTML = '';
  hideSearchHistory();
  const favorites = getFavorites();
  renderCustomGrid('My Favorites', favorites);
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
    card.onclick = () => openMedia(item.id, item.type, true, item.title, item.poster);
    card.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w300${item.poster}" loading="lazy" alt="${item.title}">
      <p>${item.title}</p>
    `;
    rowEl.appendChild(card);
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

// Search History Display
function showSearchHistory() {
  const history = getSearchHistory();
  if (history.length > 0 && searchHistoryContainer) {
    searchHistoryContainer.style.display = 'block';
    historyChips.innerHTML = '';
    history.forEach(term => {
      const chip = document.createElement('span');
      chip.classList.add('search-chip');
      chip.textContent = term;
      chip.onclick = () => {
        search.value = term;
        executeSearch(term);
      };
      historyChips.appendChild(chip);
    });
  }
}

function hideSearchHistory() {
  if (searchHistoryContainer) searchHistoryContainer.style.display = 'none';
}

if (search) {
  search.addEventListener('focus', showSearchHistory);
}

async function executeSearch(searchTerm) {
  contentContainer.innerHTML = '';
  heroSet = false;
  hideSearchHistory();
  saveSearchHistory(searchTerm);

  const urls = getApiUrls(currentLang);
  try {
    const res = await fetch(urls.SEARCH_API + encodeURIComponent(searchTerm));
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const validMedia = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
      if(validMedia.length > 0) {
          setHeroBanner(validMedia[0], validMedia[0].media_type, false);
          heroSet = true;
      }
      renderSection(`Search Results for "${searchTerm}"`, validMedia, 'movie', false);
    } else {
      contentContainer.innerHTML = `<h2 style="padding: 20px;">No results found for "${searchTerm}"</h2>`;
    }
  } catch (err) { console.error('Search error:', err); }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const searchTerm = search.value.trim();
    if (searchTerm) executeSearch(searchTerm);
    else loadAllCatalog();
  });
}

document.addEventListener('DOMContentLoaded', loadAllCatalog);