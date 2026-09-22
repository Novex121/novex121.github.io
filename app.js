const TMDB_API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';
const TRAKT_CLIENT_ID = '3e846f38d38bf7553f1915993e387fbf7b0c345388c7d0d0f507ee83a483a9aa'; 

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

async function loadAllCatalog() {
  contentContainer.innerHTML = '';
  heroSet = false;
  setActiveNav(0);
  
  // 1. TRAKT API: Trending Movies
  await fetchAndRenderTraktMovies();
  
  // 2. TVMAZE API: Popular TV Series
  await fetchAndRenderTvMazeSeries();
  
  // 3. JIKAN (MYANIMELIST) API: Top Airing Anime
  await fetchAndRenderJikanAnime();
}

async function loadOnlyType(type) {
  contentContainer.innerHTML = '';
  heroSet = false;
  
  if (type === 'movie') {
      setActiveNav(1);
      await fetchAndRenderTraktMovies();
  } else if (type === 'tv') {
      setActiveNav(2);
      await fetchAndRenderTvMazeSeries();
      await fetchAndRenderJikanAnime();
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

// --- API 1: TRAKT API (Trending Movies) ---
async function fetchAndRenderTraktMovies() {
  try {
    const response = await fetch(`https://api.trakt.tv/trending/movies?extended=full`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      const items = data.slice(0, 15).map(item => ({
        title: item.movie.title,
        rating: item.movie.rating ? (item.movie.rating * 10).toFixed(1) : 'N/A',
        media_type: 'movie'
      }));
      // Enrich with TMDB Posters
      await enrichAndRenderItems('Trending Movies (Trakt)', items, 'movie');
    }
  } catch (error) {
    console.error(`Error fetching Trakt movies:`, error);
  }
}

// --- API 2: TVMAZE API (Popular TV Series) ---
async function fetchAndRenderTvMazeSeries() {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows`);
    const shows = await response.json();
    
    shows.sort((a, b) => b.weight - a.weight);
    const topShows = shows.slice(0, 15);

    const tvMazeItems = topShows.map(show => ({
      title: show.name,
      poster_path: show.image ? show.image.medium : null,
      vote_average: show.rating ? show.rating.average : 'N/A',
      media_type: 'tv'
    })).filter(item => item.poster_path !== null);

    if (!heroSet && tvMazeItems.length > 0) {
      setHeroBannerCustom({
        title: tvMazeItems[0].title,
        poster_path: tvMazeItems[0].poster_path,
        vote_average: tvMazeItems[0].vote_average,
        type: 'Series'
      });
      heroSet = true;
    }

    renderCardSection('Popular Series (TVMaze)', tvMazeItems, 'tv', false);
  } catch (error) {
    console.error("Error fetching TVMaze series:", error);
  }
}

// --- API 3: JIKAN / MYANIMELIST API (Top Anime) ---
async function fetchAndRenderJikanAnime() {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/top/anime?filter=airing&limit=15`);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const animeItems = data.data.map(anime => ({
        title: anime.title_english || anime.title,
        poster_path: anime.images.jpg.large_image_url,
        vote_average: anime.score || 'N/A',
        media_type: 'tv'
      }));

      if (!heroSet && animeItems.length > 0) {
          setHeroBannerCustom({
              title: animeItems[0].title,
              poster_path: animeItems[0].poster_path,
              vote_average: animeItems[0].vote_average,
              type: 'Anime'
          });
          heroSet = true;
      }
      renderCardSection('Top Airing Anime (MyAnimeList)', animeItems, 'tv', true);
    }
  } catch (error) {
    console.error(`Error fetching Jikan anime:`, error);
  }
}

// --- API 4: TMDB API (Poster Enrichment, Search, & Video Resolver) ---
async function enrichAndRenderItems(sectionTitle, items, mediaType) {
  const enrichedItems = [];

  for (const item of items) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const match = data.results[0];
        if (match.poster_path) {
          enrichedItems.push({
            id: match.id,
            title: item.title,
            poster_path: match.poster_path,
            backdrop_path: match.backdrop_path || match.poster_path,
            vote_average: match.vote_average || item.rating,
            media_type: mediaType
          });
        }
      }
    } catch (e) {
      console.error("TMDB Enrichment error:", e);
    }
  }

  if (enrichedItems.length > 0) {
    if (!heroSet) {
      setHeroBanner(enrichedItems[0], mediaType);
      heroSet = true;
    }
    renderCardSection(sectionTitle, enrichedItems, mediaType, false);
  }
}

function setHeroBanner(item, defaultType) {
    const displayTitle = item.title;
    const mediaType = item.media_type || defaultType;
    const backdropPath = item.backdrop_path || item.poster_path;
    const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : 'N/A';
    
    if (backdropPath) {
        let imgUrl = backdropPath.startsWith('http') ? backdropPath : `https://image.tmdb.org/t/p/original${backdropPath}`;
        heroBanner.style.backgroundImage = `url(${imgUrl})`;
    }
    heroTitle.textContent = displayTitle;
    heroMeta.textContent = `⭐ ${rating} | ${mediaType === 'tv' ? 'Series' : 'Movie'}`;
    heroPlayBtn.onclick = () => openStreamByName(displayTitle, mediaType);
}

function setHeroBannerCustom(item) {
    heroBanner.style.backgroundImage = `url(${item.poster_path})`;
    heroTitle.textContent = item.title;
    heroMeta.textContent = `⭐ ${item.vote_average || 'N/A'} | ${item.type}`;
    heroPlayBtn.onclick = () => openStreamByName(item.title, 'tv');
}

function renderCardSection(sectionTitle, items, mediaType, isAnime = false) {
  const sectionEl = document.createElement('div');
  const titleEl = document.createElement('h2');
  titleEl.classList.add('section-title');
  titleEl.textContent = sectionTitle;
  sectionEl.appendChild(titleEl);

  const rowEl = document.createElement('div');
  rowEl.classList.add('movie-row');

  items.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('movie');
    card.onclick = () => openStreamByName(item.title, mediaType);

    const badgeText = mediaType === 'tv' ? (isAnime ? 'Anime' : 'Series') : 'Movie';
    const posterUrl = item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w300${item.poster_path}`;

    card.innerHTML = `
      <span class="badge">${badgeText}</span>
      <img src="${posterUrl}" loading="lazy" alt="${item.title}">
      <div class="movie-info">
        <h3>${item.title}</h3>
      </div>
    `;
    rowEl.appendChild(card);
  });

  sectionEl.appendChild(rowEl);
  contentContainer.appendChild(sectionEl);
}

// TMDB Dynamic ID Resolver for Embedding
async function openStreamByName(title, type) {
    if (type === 'movie') {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
            const data = await res.json();
            if(data.results && data.results.length > 0) {
                tvControls.style.display = 'none';
                iframe.src = `https://vidsrc.cc/v2/embed/movie/${data.results[0].id}`;
                videoModal.style.display = 'flex';
            }
        } catch(err) { console.error(err); }
        return;
    }

    tvControls.style.display = 'flex';
    seasonSelect.innerHTML = '<option value="1">Season 1</option>';
    episodeSelect.innerHTML = '<option value="1">Episode 1</option>';
    videoModal.style.display = 'flex';
    iframe.src = '';

    try {
        const searchRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
        const searchData = await searchRes.json();
        
        if(searchData.results && searchData.results.length > 0) {
            const tmdbTvId = searchData.results[0].id;
            openTvMedia(tmdbTvId);
        } else {
            alert('Stream source not available for this title.');
            closePlayer();
        }
    } catch (e) {
        console.error("Stream resolution error:", e);
    }
}

async function openTvMedia(id) {
  currentMedia = { id, type: 'tv', seasonsData: [] };
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=${currentLang}`);
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
  if(episodeSelect.options.length > 0) episodeSelect.value = "1";
  updatePlayerUrl(selectedSeason, 1);
}

function onEpisodeChange() {
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  const selectedEpisode = parseInt(episodeSelect.value) || 1;
  updatePlayerUrl(selectedSeason, selectedEpisode);
}

function updateEpisodesAndPlay() {
  updateEpisodeDropdown();
  const selectedSeason = parseInt(seasonSelect.value) || 1;
  updatePlayerUrl(selectedSeason, 1);
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
  iframe.src = `https://vidsrc.cc/v2/embed/tv/${currentMedia.id}/${season}/${episode}`;
}

function closePlayer() {
  iframe.src = '';
  videoModal.style.display = 'none';
}

// Search Logic using TMDB Multi Search
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchTerm = search.value.trim();

  if (searchTerm && searchTerm !== '') {
    contentContainer.innerHTML = '';
    heroSet = false;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=${currentLang}&query=` + encodeURIComponent(searchTerm));
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const validMedia = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        if(validMedia.length > 0) {
            setHeroBanner(validMedia[0], validMedia[0].media_type);
            heroSet = true;
        }
        renderCardSection(`Search Results for "${searchTerm}"`, validMedia.map(m => ({
            id: m.id,
            title: m.title || m.name,
            poster_path: m.poster_path,
            backdrop_path: m.backdrop_path,
            vote_average: m.vote_average
        })), 'movie');
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