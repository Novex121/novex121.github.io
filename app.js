const API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';

const contentContainer = document.getElementById('content-container');
const form = document.getElementById('form');
const search = document.getElementById('search');
const languageSelect = document.getElementById('languageSelect');
const videoModal = document.getElementById('videoModal');
const iframe = document.getElementById('player');
const tvControls = document.getElementById('tvControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');

// Hero Banner elements
const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroPlayBtn = document.getElementById('hero-play');

let currentLang = localStorage.getItem('novex_lang') || 'en-US';
let currentMedia = { id: null, type: null, seasonsData: [] };
let heroSet = false;

if (languageSelect) {
  languageSelect.value = currentLang;
}

function getApiUrls(lang) {
  return {
    MOVIES_URL: `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=${lang}`,
    SERIES_URL: `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEY}&language=${lang}`,
    ANIME_URL: `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=${lang}`,
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
  const urls = getApiUrls(currentLang);
  
  await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie');
  await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv');
  await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv');
}

async function loadOnlyType(type) {
  contentContainer.innerHTML = '';
  heroSet = false;
  const urls = getApiUrls(currentLang);
  
  if (type === 'movie') {
      setActiveNav(1);
      await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie');
  } else if (type === 'tv') {
      setActiveNav(2);
      await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv');
      await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv');
  }
}

function setActiveNav(index) {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if(navItems[index]) navItems[index].classList.add('active');
}

function onLanguageChange() {
  currentLang = languageSelect.value;
  localStorage.setItem('novex_lang', currentLang);
  loadAllCatalog();
}

async function fetchAndRenderSection(url, title, defaultType) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      if (!heroSet) {
          setHeroBanner(data.results[0], defaultType);
          heroSet = true;
      }
      renderSection(title, data.results, defaultType);
    }
  } catch (error) {
    console.error(`Error fetching ${title}:`, error);
  }
}

function setHeroBanner(item, defaultType) {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const backdropPath = item.backdrop_path || item.poster_path;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    
    if (backdropPath) {
        heroBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${backdropPath})`;
    }
    heroTitle.textContent = displayTitle;
    heroMeta.textContent = `⭐ ${rating} | ${mediaType === 'tv' ? 'Series / Anime' : 'Movie'}`;
    heroPlayBtn.onclick = () => openMedia(item.id, mediaType);
}

function renderSection(sectionTitle, items, defaultType = 'movie') {
  const sectionEl = document.createElement('div');

  const titleEl = document.createElement('h2');
  titleEl.classList.add('section-title');
  titleEl.textContent = sectionTitle;
  sectionEl.appendChild(titleEl);

  const rowEl = document.createElement('div');
  rowEl.classList.add('movie-row');

  items.forEach(item => {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const posterPath = item.poster_path;

    if (posterPath && displayTitle) {
      const card = document.createElement('div');
      card.classList.add('movie');
      card.onclick = () => openMedia(item.id, mediaType);

      const isAnime = item.genre_ids && item.genre_ids.includes(16);
      const badgeText = mediaType === 'tv' ? (isAnime ? 'Anime' : 'Series') : 'Movie';

      card.innerHTML = `
        <span class="badge">${badgeText}</span>
        <img src="https://image.tmdb.org/t/p/w300${posterPath}" loading="lazy" alt="${displayTitle}">
        <div class="movie-info">
          <h3>${displayTitle}</h3>
        </div>
      `;
      rowEl.appendChild(card);
    }
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

// Fixed Media Player Logic with robust Server Routing for Series & Anime
async function openMedia(id, type) {
  currentMedia = { id, type, seasonsData: [] };

  if (type === 'tv') {
    tvControls.style.display = 'flex';
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
    // Using vidsrc.me for movies as well for high reliability
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
  const selectedEpisode = 1; 
  if(episodeSelect.options.length > 0) episodeSelect.value = "1";
  updatePlayerUrl(selectedSeason, selectedEpisode);
}

function onEpisodeChange() {
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  const selectedEpisode = parseInt(episodeSelect.value) || 1;
  updatePlayerUrl(selectedSeason, selectedEpisode);
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
  // Using vidsrc.me for reliable Series and Anime playback with dub/sub streams
  iframe.src = `https://vidsrc.me/embed/tv?tmdb=${currentMedia.id}&season=${season}&episode=${episode}`;
}

function closePlayer() {
  iframe.src = '';
  videoModal.style.display = 'none';
}

// Search Logic (Filtered to only return movies and tv series/anime)
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchTerm = search.value.trim();

  if (searchTerm && searchTerm !== '') {
    contentContainer.innerHTML = '';
    heroSet = false;
    const urls = getApiUrls(currentLang);
    try {
      const res = await fetch(urls.SEARCH_API + encodeURIComponent(searchTerm));
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const validMedia = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        if(validMedia.length > 0) {
            setHeroBanner(validMedia[0], validMedia[0].media_type);
            heroSet = true;
        }
        renderSection(`Search Results for "${searchTerm}"`, validMedia);
      } else {
        contentContainer.innerHTML = `<h2 class="section-title">No results found for "${searchTerm}"</h2>`;
        heroBanner.style.backgroundImage = 'none';
        heroTitle.textContent = 'No Results';
      }
    } catch (err) { console.error('Search error:', err); }
    search.value = '';
  } else {
    loadAllCatalog();
  }
});

document.addEventListener('DOMContentLoaded', loadAllCatalog);