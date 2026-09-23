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
const audioTrackSelect = document.getElementById('audioTrackSelect');

const heroBanner = document.getElementById('hero-banner');
const heroTitle = document.getElementById('hero-title');
const heroMeta = document.getElementById('hero-meta');
const heroPlayBtn = document.getElementById('hero-play');

let currentLang = localStorage.getItem('novex_lang') || 'en-US';
let currentMedia = { id: null, type: null, isAnime: false, seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: 'sub' };
let heroSet = false;

if (languageSelect) {
  languageSelect.value = currentLang;
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

async function loadAllCatalog() {
  contentContainer.innerHTML = '';
  heroSet = false;
  setActiveNav(0);
  const urls = getApiUrls(currentLang);
  
  await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie', false);
  await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv', false);
  await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv', true);
  await fetchAndRenderSection(urls.KDRAMA_URL, 'K-Dramas & Asian Series', 'tv', false);
}

async function loadOnlyType(type) {
  contentContainer.innerHTML = '';
  heroSet = false;
  const urls = getApiUrls(currentLang);
  
  if (type === 'movie') {
      setActiveNav(1);
      await fetchAndRenderSection(urls.MOVIES_URL, 'Trending Movies', 'movie', false);
  } else if (type === 'tv') {
      setActiveNav(2);
      await fetchAndRenderSection(urls.SERIES_URL, 'Trending TV Series', 'tv', false);
      await fetchAndRenderSection(urls.ANIME_URL, 'Anime (Dub & Sub)', 'tv', true);
      await fetchAndRenderSection(urls.KDRAMA_URL, 'K-Dramas & Asian Series', 'tv', false);
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

async function fetchAndRenderSection(url, title, defaultType, isAnimeSection) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      if (!heroSet) {
          setHeroBanner(data.results[0], defaultType, isAnimeSection);
          heroSet = true;
      }
      renderSection(title, data.results, defaultType, isAnimeSection);
    }
  } catch (error) {
    console.error(`Error fetching ${title}:`, error);
  }
}

function setHeroBanner(item, defaultType, isAnimeSection) {
    const displayTitle = item.title || item.name || item.original_name;
    const mediaType = getMediaType(item, defaultType);
    const backdropPath = item.backdrop_path || item.poster_path;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const isAnime = isAnimeSection || (item.genre_ids && item.genre_ids.includes(16));
    
    if (backdropPath && heroBanner) {
        heroBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${backdropPath})`;
    }
    if (heroTitle) heroTitle.textContent = displayTitle;
    if (heroMeta) heroMeta.textContent = `⭐ ${rating} | ${isAnime ? 'Anime (Dub/Sub)' : (mediaType === 'tv' ? 'Series' : 'Movie')}`;
    if (heroPlayBtn) heroPlayBtn.onclick = () => openMedia(item.id, mediaType, isAnime);
}

function renderSection(sectionTitle, items, defaultType = 'movie', isAnimeSection = false) {
  const sectionEl = document.createElement('div');
  sectionEl.classList.add('media-row-section');

  const headerDiv = document.createElement('div');
  headerDiv.classList.add('section-header');

  const titleEl = document.createElement('h2');
  titleEl.textContent = sectionTitle;
  headerDiv.appendChild(titleEl);

  const seeAllEl = document.createElement('span');
  seeAllEl.classList.add('see-all');
  seeAllEl.innerHTML = 'All &gt;';
  headerDiv.appendChild(seeAllEl);

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
      
      const isAnime = isAnimeSection || (item.genre_ids && item.genre_ids.includes(16)) || sectionTitle.toLowerCase().includes('anime');
      card.onclick = () => openMedia(item.id, mediaType, isAnime);

      const badgeText = mediaType === 'tv' ? (isAnime ? 'Anime' : 'Series') : 'Movie';

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

async function openMedia(id, type, isAnime) {
  currentMedia = { id, type, isAnime, seasonsData: [], currentSeason: 1, currentEpisode: 1, audioType: audioTrackSelect ? audioTrackSelect.value : 'sub' };

  if (type === 'tv' || isAnime) {
    tvControls.style.display = 'flex';
    if(audioTrackSelect) audioTrackSelect.style.display = isAnime ? 'inline-block' : 'none';
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

  // Route anime and TV series reliably through primary embed source with built-in server/audio switches
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

if (form) {
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
              setHeroBanner(validMedia[0], validMedia[0].media_type, false);
              heroSet = true;
          }
          renderSection(`Search Results for "${searchTerm}"`, validMedia, 'movie', false);
        } else {
          contentContainer.innerHTML = `<h2 class="section-title" style="padding: 20px;">No results found for "${searchTerm}"</h2>`;
          if (heroBanner) heroBanner.style.backgroundImage = 'none';
          if (heroTitle) heroTitle.textContent = 'No Results';
        }
      } catch (err) { console.error('Search error:', err); }
      search.value = '';
    } else {
      loadAllCatalog();
    }
  });
}

document.addEventListener('DOMContentLoaded', loadAllCatalog);