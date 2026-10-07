/* =========================================================
   NOVEX STREAM — CLEAN SCRIPT
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       CONFIGURATION
       ========================================================= */

    // IMPORTANT:
    // Do NOT use a publicly exposed key in production.
    // Replace this with your NEW TMDB key for local testing.
    const TMDB_API_KEY = "YOUR_NEW_TMDB_API_KEY";

    const TMDB_BASE = "https://api.themoviedb.org/3";
    const TMDB_IMAGE = "https://image.tmdb.org/t/p/";

    const DB_NAME = "NovexAppDB";
    const DB_VERSION = 4;

    const STORE_DOWNLOADS = "downloads";
    const STORE_WATCHLIST = "watchlist";
    const STORE_FAVORITES = "favorites";
    const STORE_CONTINUE = "continueWatching";

    let currentLang = "en-US";

    let currentMedia = {
        id: null,
        type: null,
        isDubbable: false,
        title: "",
        poster: "",
        backdrop: "",
        seasonsData: [],
        currentSeason: 1,
        currentEpisode: 1,
        audioType: "sub"
    };

    let deferredPrompt = null;
    let heroItemsList = [];
    let heroSlideIndex = 0;
    let heroInterval = null;

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = (id) => document.getElementById(id);

    const contentContainer = $("content-container");
    const form = $("form");
    const search = $("search");

    const videoModal = $("videoModal");
    const iframe = $("player");

    const tvControls = $("tvControls");
    const seasonSelect = $("seasonSelect");
    const episodeSelect = $("episodeSelect");
    const audioLangSelect = $("audioLangSelect");

    const searchHistoryContainer = $("searchHistoryContainer");
    const historyChips = $("historyChips");

    const installAppBtn = $("installAppBtn");

    const heroBanner = $("hero-banner");
    const heroTitle = $("hero-title");
    const heroMeta = $("hero-meta");
    const heroPlayBtn = $("hero-play");
    const heroWatchlistBtn = $("hero-watchlist");

    /* =========================================================
       FALLBACK DATA
       ========================================================= */

    const FALLBACK_MOVIES = [
        {
            id: 693134,
            title: "Dune: Part Two",
            poster_path: "/8b8R8l88Qje9dn9OE8PY05NxlIF.jpg",
            backdrop_path: "/xOMo8DxXY7P6n0w6UAM8xPVDZco.jpg",
            vote_average: 8.2,
            media_type: "movie",
            original_language: "en"
        }
    ];

    const FALLBACK_TV = [
        {
            id: 109617,
            name: "Resident Evil: Infinite Darkness",
            poster_path: "/g8aKx987l2bK0sI4k64xL59g5b.jpg",
            backdrop_path: "/u9YEh2xVAPrtKoaMNllkPrtCs6s.jpg",
            vote_average: 7.3,
            media_type: "tv",
            original_language: "ja"
        },
        {
            id: 94605,
            name: "Arcane",
            poster_path: "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
            backdrop_path: "/rkB4LyZxwHNHWPRZZrA5c0l1Q7W.jpg",
            vote_average: 8.7,
            media_type: "tv",
            original_language: "en"
        }
    ];

    const FALLBACK_MEDIA = [
        ...FALLBACK_TV,
        ...FALLBACK_MOVIES
    ];

    /* =========================================================
       PWA INSTALLATION
       ========================================================= */

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();

        deferredPrompt = event;

        if (installAppBtn) {
            installAppBtn.style.display = "block";
        }
    });

    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;

        if (installAppBtn) {
            installAppBtn.style.display = "none";
        }
    });

    async function installPWA() {
        if (!deferredPrompt) {
            alert("Install option is not currently available.");
            return;
        }

        deferredPrompt.prompt();

        try {
            const result = await deferredPrompt.userChoice;

            if (result.outcome === "accepted") {
                if (installAppBtn) {
                    installAppBtn.style.display = "none";
                }
            }
        } catch (error) {
            console.error("PWA installation error:", error);
        }

        deferredPrompt = null;
    }

    window.installPWA = installPWA;

    /* =========================================================
       INDEXEDDB
       ========================================================= */

    function openAppDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
                    db.createObjectStore(STORE_DOWNLOADS, {
                        keyPath: "id"
                    });
                }

                if (!db.objectStoreNames.contains(STORE_WATCHLIST)) {
                    db.createObjectStore(STORE_WATCHLIST, {
                        keyPath: "id"
                    });
                }

                if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                    db.createObjectStore(STORE_FAVORITES, {
                        keyPath: "id"
                    });
                }

                if (!db.objectStoreNames.contains(STORE_CONTINUE)) {
                    db.createObjectStore(STORE_CONTINUE, {
                        keyPath: "id"
                    });
                }
            };
        });
    }

    async function dbPut(storeName, item) {
        const db = await openAppDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store = transaction.objectStore(storeName);

            const request = store.put(item);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function dbDelete(storeName, id) {
        const db = await openAppDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store = transaction.objectStore(storeName);

            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async function dbGetAll(storeName) {
        const db = await openAppDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store = transaction.objectStore(storeName);

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async function dbExists(storeName, id) {
        const items = await dbGetAll(storeName);

        return items.some(
            item => String(item.id) === String(id)
        );
    }

    /* =========================================================
       SEARCH HISTORY
       ========================================================= */

    function getSearchHistory() {
        try {
            const saved = localStorage.getItem(
                "novex_search_history"
            );

            const parsed = JSON.parse(saved);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error(
                "Search history error:",
                error
            );

            return [];
        }
    }

    function saveSearchHistory(term) {
        if (!term) return;

        let history = getSearchHistory();

        history = history.filter(
            item =>
                item.toLowerCase() !==
                term.toLowerCase()
        );

        history.unshift(term);

        if (history.length > 8) {
            history = history.slice(0, 8);
        }

        localStorage.setItem(
            "novex_search_history",
            JSON.stringify(history)
        );
    }

    function showSearchHistory() {
        if (!searchHistoryContainer || !historyChips) {
            return;
        }

        const history = getSearchHistory();

        if (history.length === 0) {
            searchHistoryContainer.style.display = "none";
            return;
        }

        searchHistoryContainer.style.display = "block";
        historyChips.innerHTML = "";

        history.forEach(term => {
            const chip = document.createElement("span");

            chip.className = "search-chip";
            chip.textContent = term;

            chip.addEventListener("click", () => {
                if (search) {
                    search.value = term;
                }

                executeSearch(term);
            });

            historyChips.appendChild(chip);
        });
    }

    function hideSearchHistory() {
        if (searchHistoryContainer) {
            searchHistoryContainer.style.display = "none";
        }
    }

    /* =========================================================
       TMDB API
       ========================================================= */

    function getApiUrl(endpoint, params = {}) {
        const url = new URL(
            `${TMDB_BASE}/${endpoint}`
        );

        url.searchParams.set(
            "api_key",
            TMDB_API_KEY
        );

        url.searchParams.set(
            "language",
            currentLang
        );

        Object.entries(params).forEach(
            ([key, value]) => {
                if (
                    value !== undefined &&
                    value !== null
                ) {
                    url.searchParams.set(
                        key,
                        value
                    );
                }
            }
        );

        return url.toString();
    }

    async function apiFetch(
        endpoint,
        params = {},
        fallback = []
    ) {
        if (
            !TMDB_API_KEY ||
            TMDB_API_KEY === "YOUR_NEW_TMDB_API_KEY"
        ) {
            console.warn(
                "TMDB API key has not been configured."
            );

            return fallback;
        }

        try {
            const response = await fetch(
                getApiUrl(endpoint, params)
            );

            if (!response.ok) {
                throw new Error(
                    `TMDB HTTP ${response.status}`
                );
            }

            const data = await response.json();

            return Array.isArray(data.results)
                ? data.results
                : data;
        } catch (error) {
            console.error(
                "TMDB request failed:",
                error
            );

            return fallback;
        }
    }

    /* =========================================================
       MEDIA HELPERS
       ========================================================= */

    function getMediaType(item, defaultType = "movie") {
        if (item.media_type === "movie") {
            return "movie";
        }

        if (item.media_type === "tv") {
            return "tv";
        }

        if (item.name && !item.title) {
            return "tv";
        }

        return defaultType;
    }

    function getMediaTitle(item) {
        return (
            item.title ||
            item.name ||
            item.original_title ||
            item.original_name ||
            "Unknown Title"
        );
    }

    function isDubbable(item) {
        const type = getMediaType(item);

        return (
            type === "tv" &&
            ["ja", "ko", "zh"].includes(
                item.original_language
            )
        );
    }

    function getPosterUrl(path) {
        if (!path) return "";

        return `${TMDB_IMAGE}w500${path}`;
    }

    function getBackdropUrl(path) {
        if (!path) return "";

        return `${TMDB_IMAGE}original${path}`;
    }

    /* =========================================================
       LOAD CATALOG
       ========================================================= */

    async function loadAllCatalog() {
        if (!contentContainer) return;

        stopHeroSlider();

        contentContainer.innerHTML = "";

        hideSearchHistory();

        const [
            trendingAll,
            movies,
            series,
            anime,
            kdrama,
            cdrama
        ] = await Promise.all([
            apiFetch(
                "trending/all/week",
                {},
                FALLBACK_MEDIA
            ),

            apiFetch(
                "trending/movie/week",
                {},
                FALLBACK_MOVIES
            ),

            apiFetch(
                "trending/tv/week",
                {},
                FALLBACK_TV
            ),

            apiFetch(
                "discover/tv",
                {
                    with_genres: 16,
                    with_original_language: "ja",
                    sort_by: "popularity.desc"
                },
                FALLBACK_TV
            ),

            apiFetch(
                "discover/tv",
                {
                    with_original_language: "ko",
                    sort_by: "popularity.desc"
                },
                FALLBACK_TV
            ),

            apiFetch(
                "discover/tv",
                {
                    with_original_language: "zh",
                    sort_by: "popularity.desc"
                },
                FALLBACK_TV
            )
        ]);

        heroItemsList =
            trendingAll.length > 0
                ? trendingAll.slice(0, 6)
                : FALLBACK_MEDIA;

        startHeroSlider();

        renderSection(
            "Trending All",
            trendingAll,
            "movie"
        );

        renderSection(
            "Trending Movies",
            movies,
            "movie"
        );

        renderSection(
            "Trending TV Series",
            series,
            "tv"
        );

        renderSection(
            "Anime",
            anime,
            "tv",
            true
        );

        renderSection(
            "K-Dramas",
            kdrama,
            "tv",
            true
        );

        renderSection(
            "C-Dramas",
            cdrama,
            "tv",
            true
        );

        const continueItems = await getContinueWatching();
        renderLocalSection("Continue Watching", continueItems);

        await renderSmartRecommendations();
    }

    /* =========================================================
       HERO SLIDER
       ========================================================= */

    function startHeroSlider() {
        stopHeroSlider();

        if (
            !heroItemsList ||
            heroItemsList.length === 0
        ) {
            return;
        }

        heroSlideIndex = 0;

        updateHeroBanner(
            heroItemsList[heroSlideIndex]
        );

        if (heroItemsList.length <= 1) {
            return;
        }

        heroInterval = setInterval(() => {
            heroSlideIndex =
                (heroSlideIndex + 1) %
                heroItemsList.length;

            updateHeroBanner(
                heroItemsList[heroSlideIndex]
            );
        }, 10000);
    }

    function stopHeroSlider() {
        if (heroInterval) {
            clearInterval(heroInterval);
            heroInterval = null;
        }
    }

    function updateHeroBanner(item) {
        if (!item) return;

        const title = getMediaTitle(item);
        const type = getMediaType(item);
        const dubbable = isDubbable(item);

        const rating =
            Number(item.vote_average || 0).toFixed(1);

        currentMedia.heroItem = item;

        if (heroBanner) {
            const backdrop =
                item.backdrop_path ||
                item.poster_path;

            if (backdrop) {
                heroBanner.style.backgroundImage =
                    `url("${getBackdropUrl(backdrop)}")`;
            }
        }

        if (heroTitle) {
            heroTitle.textContent = title;
        }

        if (heroMeta) {
            heroMeta.textContent =
                `⭐ ${rating} • ` +
                `${type === "tv" ? "Series" : "Movie"} • ` +
                `${dubbable ? "Sub & Dub" : "Sub"}`;
        }

        if (heroPlayBtn) {
            heroPlayBtn.onclick = () => {
                openMedia(
                    item.id,
                    type,
                    dubbable,
                    title,
                    item.poster_path
                );
            };
        }

        if (heroWatchlistBtn) {
            heroWatchlistBtn.onclick = () => {
                toggleQuickWatchlist(item);
            };
        }
    }

    /* =========================================================
       RENDER MEDIA
       ========================================================= */

    function renderSection(
        sectionTitle,
        items,
        defaultType = "movie",
        forceDubbable = false
    ) {
        if (!contentContainer) return;

        if (!Array.isArray(items)) return;

        const validItems = items.filter(item => {
            return (
                item &&
                item.id &&
                item.poster_path
            );
        });

        if (validItems.length === 0) {
            return;
        }

        const section =
            document.createElement("section");

        section.className =
            "media-row-section";

        const header =
            document.createElement("div");

        header.className =
            "section-header";

        const heading =
            document.createElement("h2");

        heading.textContent =
            sectionTitle;

        header.appendChild(heading);

        const row =
            document.createElement("div");

        row.className =
            "horizontal-scroll-row";

        validItems.forEach(item => {
            const title =
                getMediaTitle(item);

            const type =
                getMediaType(
                    item,
                    defaultType
                );

            const dubbable =
                forceDubbable ||
                isDubbable(item);

            const card =
                document.createElement("article");

            card.className =
                "media-card";

            card.setAttribute(
                "tabindex",
                "0"
            );

            const badge =
                document.createElement("span");

            badge.className =
                "badge";

            badge.textContent =
                type === "tv"
                    ? "Series"
                    : "Movie";

            const image =
                document.createElement("img");

            image.src =
                getPosterUrl(
                    item.poster_path
                );

            image.loading = "lazy";

            image.alt = title;

            const titleElement =
                document.createElement("p");

            titleElement.textContent =
                title;

            card.appendChild(badge);
            card.appendChild(image);
            card.appendChild(titleElement);

            const open = () => {
                openMedia(
                    item.id,
                    type,
                  dubbable,
                    title,
                    item.poster_path
                );
            };

            card.addEventListener(
                "click",
                open
            );

            card.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        open();
                    }
                }
            );

            row.appendChild(card);
        });

        section.appendChild(header);
        section.appendChild(row);

        contentContainer.appendChild(section);
    }

    /* =========================================================
       RECOMMENDATIONS
       ========================================================= */

    async function renderSmartRecommendations() {
        try {
            const watchlist =
                await dbGetAll(
                    STORE_WATCHLIST
                );

            const favorites =
                await dbGetAll(
                    STORE_FAVORITES
                );

            const sample =
                watchlist[0] ||
                favorites[0];

            if (!sample) return;

            const type =
                sample.type === "tv"
                    ? "tv"
                    : "movie";

            const results =
                await apiFetch(
                    `${type}/${sample.id}/similar`,
                    {},
                    []
                );

            if (results.length > 0) {
                renderSection(
                    `Recommended For You`,
                    results,
                    type,
                    type === "tv"
                );
            }
        } catch (error) {
            console.error(
                "Recommendation error:",
                error
            );
        }
    }

    /* =========================================================
       PLAYER
       ========================================================= */

    async function openMedia(
        id,
        type,
        dubbable,
        title,
        poster
    ) {
        if (!id) return;

        stopHeroSlider();

        currentMedia = {
            id,
            type,
            isDubbable: Boolean(dubbable),
            title: title || "Unknown Title",
            poster: poster || "",
            backdrop: "",
            seasonsData: [],
            currentSeason: 1,
            currentEpisode: 1,
            audioType: "sub"
        };

        await updateModalActionButtons();
        await saveContinueWatching();

        if (!videoModal) {
            console.error(
                "videoModal element is missing."
            );

            return;
        }

        videoModal.style.display = "flex";

        try {
            if (
                videoModal.requestFullscreen
            ) {
                await videoModal.requestFullscreen();
            }
        } catch (error) {
            console.log(
                "Fullscreen unavailable:",
                error
            );
        }

        try {
            if (
                screen.orientation &&
                screen.orientation.lock
            ) {
                await screen.orientation.lock(
                    "landscape"
                );
            }
        } catch (error) {
            console.log(
                "Orientation lock unavailable:",
                error
            );
        }

        if (
            type === "tv"
        ) {
            await loadTVDetails(id);
        } else {
            if (tvControls) {
                tvControls.style.display =
                    "none";
            }

            playMovie(id);
        }
    }

    async function loadTVDetails(id) {
        if (tvControls) {
            tvControls.style.display = "flex";
        }

        if (seasonSelect) {
            seasonSelect.innerHTML =
                "<option>Loading...</option>";
        }

        if (episodeSelect) {
            episodeSelect.innerHTML =
                "<option>Loading...</option>";
        }

        try {
            const response =
                await fetch(
                    getApiUrl(
                        `tv/${id}`
                    )
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            let seasons =
                Array.isArray(data.seasons)
                    ? data.seasons
                    : [];

            seasons =
                seasons.filter(
                    season =>
                        season.season_number >= 0
                );

            currentMedia.seasonsData =
                seasons;

            populateSeasonDropdown(
                seasons
            );

            const firstSeason =
                seasons.find(
                    s =>
                        s.season_number > 0
                ) || seasons[0];

            const seasonNumber =
                firstSeason
                    ? firstSeason.season_number
                    : 1;

            currentMedia.currentSeason =
                seasonNumber;

            if (seasonSelect) {
                seasonSelect.value =
                    String(
                        seasonNumber
                    );
            }

            updateEpisodeDropdown();

            currentMedia.currentEpisode =
                1;

            if (episodeSelect) {
                episodeSelect.value = "1";
            }

            updatePlayerUrl(
                seasonNumber,
                1
            );
        } catch (error) {
            console.error(
                "TV details error:",
                error
            );

            populateFallbackDropdowns();

            updatePlayerUrl(1, 1);
        }
    }

    function playMovie(id) {
        if (!iframe) return;

        iframe.src =
            `https://vidsrc.me/embed/movie?tmdb=${encodeURIComponent(id)}`;
    }

    function closePlayer() {
        if (iframe) {
            iframe.src = "";
        }

        if (videoModal) {
            videoModal.style.display =
                "none";
        }

        try {
            if (
                document.fullscreenElement &&
                document.exitFullscreen
            ) {
                document.exitFullscreen();
            }
        } catch (error) {
            console.log(error);
        }

        try {
            if (
                screen.orientation &&
                screen.orientation.unlock
            ) {
                screen.orientation.unlock();
            }
        } catch (error) {
            console.log(error);
        }

        startHeroSlider();
    }

    window.closePlayer = closePlayer;
  /* =========================================================
       SEARCH
       ========================================================= */

    async function executeSearch(
        searchTerm
    ) {
        if (!searchTerm) return;

        stopHeroSlider();

        if (!contentContainer) return;

        contentContainer.innerHTML = "";

        hideSearchHistory();

        saveSearchHistory(
            searchTerm
        );

        const results =
            await apiFetch(
                "search/multi",
                {
                    query: searchTerm
                },
                []
            );

        const validResults =
            results.filter(
                item =>
                    item.media_type ===
                        "movie" ||
                    item.media_type ===
                        "tv"
            );

        if (
            validResults.length === 0
        ) {
            const message =
                document.createElement(
                    "h2"
                );

            message.style.padding =
                "20px";

            message.textContent =
                `No results found for "${searchTerm}"`;

            contentContainer.appendChild(
                message
            );

            return;
        }

        renderSection(
            `Search Results for "${searchTerm}"`,
            validResults
        );
    }


    /* =========================================================
       NOVEX 2.0 — LOCAL LIBRARY + CONTINUE WATCHING
       ========================================================= */

    async function dbEnsureContinueStore() {
        const db = await openAppDB();
        return db;
    }

    async function saveContinueWatching() {
        if (!currentMedia || !currentMedia.id) return;
        try {
            await dbPut(STORE_CONTINUE, {
                id: String(currentMedia.id) + ":" + String(currentMedia.type || "movie"),
                mediaId: currentMedia.id,
                type: currentMedia.type,
                title: currentMedia.title,
                poster: currentMedia.poster,
                season: currentMedia.currentSeason || 1,
                episode: currentMedia.currentEpisode || 1,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.warn("Continue watching save failed:", error);
        }
    }

    async function getContinueWatching() {
        try {
            return await dbGetAll(STORE_CONTINUE);
        } catch (error) {
            return [];
        }
    }

    function renderLocalSection(title, items, emptyText = "") {
        if (!contentContainer || !Array.isArray(items) || items.length === 0) return;
        const section = document.createElement("section");
        section.className = "media-row-section";

        const header = document.createElement("div");
        header.className = "section-header";
        const heading = document.createElement("h2");
        heading.textContent = title;
        header.appendChild(heading);

        const row = document.createElement("div");
        row.className = "horizontal-scroll-row";

        items.sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
            .slice(0, 12)
            .forEach(item => {
                const card = document.createElement("article");
                card.className = "media-card";
                card.tabIndex = 0;

                const img = document.createElement("img");
                img.src = item.poster ? getPosterUrl(item.poster) : "";
                img.alt = item.title || "Novex title";
                img.loading = "lazy";

                const badge = document.createElement("span");
                badge.className = "badge";
                badge.textContent = item.type === "tv"
                    ? `S${item.season || 1} E${item.episode || 1}`
                    : "Continue";

                const name = document.createElement("p");
                name.textContent = item.title || "Untitled";

                card.append(badge, img, name);

                const open = () => openMedia(
                    item.mediaId,
                    item.type || "movie",
                    item.type === "tv",
                    item.title,
                    item.poster
                );

                card.addEventListener("click", open);
                card.addEventListener("keydown", e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open();
                    }
                });

                row.appendChild(card);
            });

        section.append(header, row);
        contentContainer.appendChild(section);
    }

    async function loadLocalLibrary(storeName, title) {
        stopHeroSlider();
        if (!contentContainer) return;
        contentContainer.innerHTML = "";
        hideSearchHistory();

        try {
            const items = await dbGetAll(storeName);
            if (!items.length) {
                const empty = document.createElement("div");
                empty.style.padding = "40px 20px";
                empty.style.textAlign = "center";
                empty.innerHTML = "<h2>" + title + "</h2><p style='color:#aaa;margin-top:8px'>Nothing here yet.</p>";
                contentContainer.appendChild(empty);
                return;
            }
            renderLocalSection(title, items);
        } catch (error) {
            console.error(title + " error:", error);
        }
    }

    async function loadWatchlist() {
        await loadLocalLibrary(STORE_WATCHLIST, "My Watchlist");
    }

    async function loadFavorites() {
        await loadLocalLibrary(STORE_FAVORITES, "My Favorites");
    }

    async function loadDownloads() {
        await loadLocalLibrary(STORE_DOWNLOADS, "Saved for Offline");
    }

    async function toggleQuickWatchlist(item) {
        if (!item || !item.id) return;
        const exists = await dbExists(STORE_WATCHLIST, item.id);
        if (exists) {
            await dbDelete(STORE_WATCHLIST, item.id);
        } else {
            await dbPut(STORE_WATCHLIST, {
                id: item.id,
                type: getMediaType(item),
                title: getMediaTitle(item),
                poster: item.poster_path || "",
                addedAt: Date.now()
            });
        }
    }

    async function toggleWatchlist() {
        if (!currentMedia.id) return;
        const exists = await dbExists(STORE_WATCHLIST, currentMedia.id);
        if (exists) {
            await dbDelete(STORE_WATCHLIST, currentMedia.id);
        } else {
            await dbPut(STORE_WATCHLIST, {
                id: currentMedia.id,
                type: currentMedia.type,
                title: currentMedia.title,
                poster: currentMedia.poster,
                addedAt: Date.now()
            });
        }
        await updateModalActionButtons();
    }

    async function toggleFavorite() {
        if (!currentMedia.id) return;
        const exists = await dbExists(STORE_FAVORITES, currentMedia.id);
        if (exists) {
            await dbDelete(STORE_FAVORITES, currentMedia.id);
        } else {
            await dbPut(STORE_FAVORITES, {
                id: currentMedia.id,
                type: currentMedia.type,
                title: currentMedia.title,
                poster: currentMedia.poster,
                addedAt: Date.now()
            });
        }
        await updateModalActionButtons();
    }

    async function toggleAppDownload() {
        if (!currentMedia.id) return;
        const key = String(currentMedia.id) + ":" + String(currentMedia.type || "movie");
        const exists = await dbExists(STORE_DOWNLOADS, key);
        if (exists) {
            await dbDelete(STORE_DOWNLOADS, key);
        } else {
            await dbPut(STORE_DOWNLOADS, {
                id: key,
                mediaId: currentMedia.id,
                type: currentMedia.type,
                title: currentMedia.title,
                poster: currentMedia.poster,
                savedAt: Date.now(),
                note: "Saved to Novex library. Playback download requires an authorized media source."
            });
        }
        await updateModalActionButtons();
    }

    async function updateModalActionButtons() {
        const pairs = [
            ["modalWatchlistBtn", STORE_WATCHLIST],
            ["modalFavoriteBtn", STORE_FAVORITES]
        ];

        for (const [id, store] of pairs) {
            const button = $(id);
            if (!button || !currentMedia.id) continue;
            const active = await dbExists(store, currentMedia.id);
            button.style.color = active ? "var(--accent-red)" : "white";
        }

        const downloadButton = $("modalDownloadBtn");
        if (downloadButton && currentMedia.id) {
            const key = String(currentMedia.id) + ":" + String(currentMedia.type || "movie");
            const active = await dbExists(STORE_DOWNLOADS, key);
            downloadButton.style.color = active ? "var(--accent-red)" : "white";
        }
    }

    window.loadWatchlist = loadWatchlist;
    window.loadFavorites = loadFavorites;
    window.loadDownloads = loadDownloads;
    window.toggleWatchlist = toggleWatchlist;
    window.toggleFavorite = toggleFavorite;
    window.toggleAppDownload = toggleAppDownload;
    window.toggleQuickWatchlist = toggleQuickWatchlist;

    /* =========================================================
       PWA SERVICE WORKER
       ========================================================= */

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./sw.js", { scope: "./" })
                .then(() => console.log("NOVEX service worker ready"))
                .catch(error => console.warn("NOVEX service worker failed:", error));
        });
    }

    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    if (search) {
        search.addEventListener(
            "focus",
            showSearchHistory
        );
    }

    if (form) {
        form.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                const term =
                    search?.value.trim();

                if (term) {
                    executeSearch(term);
                } else {
                    loadAllCatalog();
                }
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            loadAllCatalog();
        }
    );

})();
