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
    const TMDB_API_KEY = "'4cace2e053c8bc8ae6ed960c3518c853';";

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
    const novexSplash = $("novexSplash");

    /* =========================================================
       APP LAUNCH EXPERIENCE
       ========================================================= */

    function showNovexSplash() {
        if (!novexSplash) return;

        const standalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;

        if (!standalone) {
            novexSplash.classList.add("is-hidden");
            return;
        }

        // Keep the launch animation premium, but never allow it to block
        // the app indefinitely if the page has a slow/hung load event.
        const minimumTime = 1150;
        const maximumTime = 3000;
        const startedAt = performance.now();
        let finished = false;

        const hide = () => {
            if (finished) return;
            finished = true;

            const elapsed = performance.now() - startedAt;
            const remaining = Math.max(0, minimumTime - elapsed);

            window.setTimeout(() => {
                novexSplash.classList.add("is-hidden");
                window.setTimeout(() => {
                    if (novexSplash && novexSplash.isConnected) {
                        novexSplash.remove();
                    }
                }, 650);
            }, remaining);
        };

        // Normal path: wait for the page to finish loading, but respect the
        // minimum animation time.
        if (document.readyState === "complete") {
            hide();
        } else {
            window.addEventListener("load", hide, { once: true });
        }

        // Safety valve: the splash can never trap the user indefinitely.
        window.setTimeout(hide, maximumTime);
    }
    showNovexSplash();

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
            poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
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

    function getPosterFallback(title = "NOVEX", type = "movie") {
        const safeTitle = String(title || "NOVEX")
            .replace(/[&<>"]/g, "")
            .slice(0, 26);

        const label = type === "tv" ? "SERIES" : "MOVIE";

        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#e50914"/>
                        <stop offset="100%" stop-color="#3a0a0d"/>
                    </linearGradient>
                </defs>
                <rect width="500" height="750" fill="#0b0b0e"/>
                <rect width="500" height="750" fill="url(#g)" opacity=".22"/>
                <text x="34" y="82" fill="#ffffff" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="5">NOVEX</text>
                <text x="34" y="620" fill="#ffffff" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="3">${label}</text>
                <text x="34" y="664" fill="#ffffff" font-family="Arial,sans-serif" font-size="28" font-weight="800">${safeTitle}</text>
                <rect x="34" y="690" width="72" height="5" rx="3" fill="#e50914"/>
            </svg>`;

        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    }

    function protectPosterImage(image, title, type) {
        if (!image) return;

        image.addEventListener("error", () => {
            if (image.dataset.novexFallback === "1") return;
            image.dataset.novexFallback = "1";
            image.src = getPosterFallback(title, type);
        }, { once: true });
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

        const [continueItems, watchlist, favorites] = await Promise.all([
            getContinueWatching(),
            dbGetAll(STORE_WATCHLIST),
            dbGetAll(STORE_FAVORITES)
        ]);

        // Returning users get their personal shelf before discovery content.
        renderLocalSection("Continue Watching", continueItems);
        renderLocalSection(
            continueItems.length ? "My Picks" : "Your Library",
            continueItems.length ? [] : [...favorites, ...watchlist]
        );

        const [
            trendingAll,
            movies,
            series,
            anime,
            kdrama,
            cdrama
        ] = await Promise.all([
            apiFetch("trending/all/week", {}, FALLBACK_MEDIA),
            apiFetch("trending/movie/week", {}, FALLBACK_MOVIES),
            apiFetch("trending/tv/week", {}, FALLBACK_TV),
            apiFetch("discover/tv", {
                with_genres: 16,
                with_original_language: "ja",
                sort_by: "popularity.desc"
            }, FALLBACK_TV),
            apiFetch("discover/tv", {
                with_original_language: "ko",
                sort_by: "popularity.desc"
            }, FALLBACK_TV),
            apiFetch("discover/tv", {
                with_original_language: "zh",
                sort_by: "popularity.desc"
            }, FALLBACK_TV)
        ]);

        heroItemsList = trendingAll.length > 0
            ? trendingAll.slice(0, 6)
            : FALLBACK_MEDIA;

        startHeroSlider();

        if (!continueItems.length) {
            renderSection("Trending Now", trendingAll, "movie");
        } else {
            renderSection("Trending Now", trendingAll.slice(0, 12), "movie");
        }

        renderSection("Trending Movies", movies, "movie");
        renderSection("Trending TV Series", series, "tv");
        renderSection("Anime", anime, "tv", true);
        renderSection("K-Dramas", kdrama, "tv", true);
        renderSection("C-Dramas", cdrama, "tv", true);

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
                openTitleDetails(item, type);
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
            protectPosterImage(image, title, type);

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
            const [watchlist, favorites, continueItems] = await Promise.all([
                dbGetAll(STORE_WATCHLIST),
                dbGetAll(STORE_FAVORITES),
                dbGetAll(STORE_CONTINUE)
            ]);

            const seeds = [...continueItems, ...favorites, ...watchlist]
                .filter(item => item && item.id != null)
                .filter((item, index, arr) =>
                    arr.findIndex(x => String(x.id) === String(item.id)) === index
                )
                .slice(0, 4);

            if (!seeds.length) return;

            const recommendationGroups = await Promise.all(
                seeds.map(async seed => {
                    const type = seed.type === "tv" ? "tv" : "movie";
                    return apiFetch(type + "/" + seed.id + "/similar", {}, [])
                        .then(results => results.map(item => Object.assign({}, item, {media_type:type})));
                })
            );

            const seen = new Set(seeds.map(item => String(item.id)));
            const recommendations = [];

            recommendationGroups.flat().forEach(item => {
                if (!item || !item.id || !item.poster_path) return;
                const key = String(item.id) + ":" + getMediaType(item);
                if (seen.has(String(item.id)) || seen.has(key)) return;
                seen.add(String(item.id));
                seen.add(key);
                recommendations.push(item);
            });

            if (recommendations.length) {
                const title = continueItems.length
                    ? "Because You're Watching"
                    : "Recommended For You";

                renderSection(
                    title,
                    recommendations.slice(0, 18),
                    "movie"
                );
            }
        } catch (error) {
            console.error("Recommendation error:", error);
        }
    }

    /* =========================================================
       PLAYER
       ========================================================= */


    /* =========================================================
       TITLE DETAILS EXPERIENCE
       ========================================================= */
    let detailsMedia = null;
    const titleDetails = $("titleDetails");
    const detailsBackdrop = $("detailsBackdrop");
    const detailsPoster = $("detailsPoster");
    const detailsTitle = $("detailsTitle");
    const detailsKicker = $("detailsKicker");
    const detailsMeta = $("detailsMeta");
    const detailsOverview = $("detailsOverview");
    const detailsGenres = $("detailsGenres");
    const detailsEpisodes = $("detailsEpisodes");
    const detailsSeasonSelect = $("detailsSeasonSelect");
    const detailsEpisodeList = $("detailsEpisodeList");
    const detailsSimilarSection = $("detailsSimilarSection");
    const detailsSimilarRow = $("detailsSimilarRow");

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value || "");
        return div.innerHTML;
    }

    function detailYear(item) {
        const date = item.release_date || item.first_air_date || "";
        return date ? date.slice(0, 4) : "";
    }

    function setDetailsButtonState(button, active) {
        if (button) button.classList.toggle("is-active", Boolean(active));
    }

    async function openTitleDetails(item, fallbackType) {
        if (!item || !item.id || !titleDetails) return;
        stopHeroSlider();
        const type = getMediaType(item, fallbackType || "movie");
        detailsMedia = Object.assign({}, item, {media_type:type});
        titleDetails.classList.add("is-open");
        titleDetails.setAttribute("aria-hidden", "false");
        document.body.classList.add("details-open");

        const title = getMediaTitle(detailsMedia);
        detailsTitle.textContent = title;
        detailsKicker.textContent = type === "tv" ? "SERIES" : "MOVIE";
        detailsPoster.src = getPosterUrl(detailsMedia.poster_path || detailsMedia.poster || "");
        detailsPoster.alt = title;
        const backdrop = detailsMedia.backdrop_path || detailsMedia.poster_path || detailsMedia.poster || "";
        detailsBackdrop.style.backgroundImage = backdrop ? 'url("' + getBackdropUrl(backdrop) + '")' : "none";
        detailsMeta.textContent = [detailYear(detailsMedia), detailsMedia.vote_average ? "⭐ " + Number(detailsMedia.vote_average).toFixed(1) : "", type === "tv" ? "Series" : "Movie", isDubbable(detailsMedia) ? "Sub & Dub" : "Sub"].filter(Boolean).join(" • ");
        detailsOverview.textContent = detailsMedia.overview || "Discover more about this title on Novex. Choose Play to start watching.";
        detailsGenres.innerHTML = Array.isArray(detailsMedia.genres) ? detailsMedia.genres.map(function(g){ return '<span class="details-genre">' + escapeHtml(g.name) + '</span>'; }).join("") : "";
        detailsEpisodes.hidden = type !== "tv";
        detailsSimilarSection.hidden = true;
        detailsEpisodeList.innerHTML = type === "tv" ? '<div class="details-loading">Loading episodes...</div>' : "";

        setDetailsButtonState($("detailsWatchlist"), await dbExists(STORE_WATCHLIST, detailsMedia.id));
        setDetailsButtonState($("detailsFavorite"), await dbExists(STORE_FAVORITES, detailsMedia.id));
        setDetailsButtonState($("detailsDownload"), await dbExists(STORE_DOWNLOADS, String(detailsMedia.id) + ":" + type));

        if (TMDB_API_KEY !== "YOUR_NEW_TMDB_API_KEY") {
            try {
                const response = await fetch(getApiUrl(type + "/" + item.id, {append_to_response:"similar"}));
                if (response.ok) {
                    const full = await response.json();
                    detailsMedia = Object.assign(detailsMedia, full, {media_type:type});
                    detailsOverview.textContent = full.overview || detailsOverview.textContent;
                    detailsMeta.textContent = [detailYear(full), full.vote_average ? "⭐ " + Number(full.vote_average).toFixed(1) : "", type === "tv" ? ((full.number_of_seasons || 0) + " Seasons") : (full.runtime ? full.runtime + " min" : ""), isDubbable(detailsMedia) ? "Sub & Dub" : "Sub"].filter(Boolean).join(" • ");
                    detailsGenres.innerHTML = Array.isArray(full.genres) ? full.genres.map(function(g){ return '<span class="details-genre">' + escapeHtml(g.name) + '</span>'; }).join("") : "";
                    if (type === "tv") renderDetailsSeasons(full.seasons || []);
                    const similar = full.similar && Array.isArray(full.similar.results) ? full.similar.results.slice(0, 12) : [];
                    renderDetailsSimilar(similar, type);
                }
            } catch (error) { console.warn("Title details request failed:", error); }
        } else if (type === "tv") {
            detailsEpisodes.hidden = true;
        }
    }

    function renderDetailsSeasons(seasons) {
        const usable = (seasons || []).filter(function(s){ return Number(s.season_number) > 0; });
        detailsSeasonSelect.innerHTML = usable.map(function(s){ return '<option value="' + s.season_number + '">' + escapeHtml(s.name || ("Season " + s.season_number)) + '</option>'; }).join("");
        if (!usable.length) { detailsEpisodes.hidden = true; return; }
        detailsEpisodes.hidden = false;
        detailsSeasonSelect.onchange = function(){ loadDetailsEpisodes(Number(detailsSeasonSelect.value)); };
        loadDetailsEpisodes(usable[0].season_number);
    }

    async function loadDetailsEpisodes(seasonNumber) {
        if (!detailsMedia || detailsMedia.media_type !== "tv") return;
        detailsEpisodeList.innerHTML = '<div class="details-loading">Loading episodes...</div>';
        if (TMDB_API_KEY === "YOUR_NEW_TMDB_API_KEY") {
            detailsEpisodeList.innerHTML = '<div class="details-loading">Add your TMDB key to load episode information.</div>';
            return;
        }
        try {
            const response = await fetch(getApiUrl("tv/" + detailsMedia.id + "/season/" + seasonNumber));
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            detailsEpisodeList.innerHTML = (data.episodes || []).map(function(ep){
                return '<button class="details-episode" type="button" data-episode="' + ep.episode_number + '"><strong>' + ep.episode_number + '. ' + escapeHtml(ep.name || "Episode") + '</strong><span>' + escapeHtml(ep.overview ? ep.overview.slice(0,90) : "Ready to watch") + '</span></button>';
            }).join("");
            detailsEpisodeList.querySelectorAll(".details-episode").forEach(function(btn){
                btn.addEventListener("click", function(){
                    const episode = Number(btn.dataset.episode);
                    const media = detailsMedia;
                    closeTitleDetails();
                    openMedia(media.id, "tv", isDubbable(media), getMediaTitle(media), media.poster_path || "");
                    setTimeout(function(){
                        if (seasonSelect) seasonSelect.value = String(seasonNumber);
                        onSeasonChange();
                        setTimeout(function(){
                            if (episodeSelect) {
                                episodeSelect.value = String(episode);
                                onEpisodeChange();
                            }
                        }, 180);
                    }, 300);
                });
            });
        } catch (error) {
            detailsEpisodeList.innerHTML = '<div class="details-loading">Episodes are unavailable right now.</div>';
        }
    }

    function renderDetailsSimilar(items, type) {
        const valid = (items || []).filter(function(x){ return x && x.id && x.poster_path; }).slice(0,12);
        if (!valid.length) { detailsSimilarSection.hidden = true; return; }
        detailsSimilarSection.hidden = false;
        detailsSimilarRow.innerHTML = valid.map(function(x){
            return '<article class="details-similar-card" data-id="' + x.id + '"><img src="' + getPosterUrl(x.poster_path) + '" alt="' + escapeHtml(getMediaTitle(x)) + '" loading="lazy"><p>' + escapeHtml(getMediaTitle(x)) + '</p></article>';
        }).join("");
        detailsSimilarRow.querySelectorAll(".details-similar-card").forEach(function(card){
            const found = valid.find(function(x){ return String(x.id) === String(card.dataset.id); });
            card.addEventListener("click", function(){ openTitleDetails(found, type); });
        });
    }

    function closeTitleDetails() {
        if (!titleDetails) return;
        titleDetails.classList.remove("is-open");
        titleDetails.setAttribute("aria-hidden", "true");
        document.body.classList.remove("details-open");
        detailsMedia = null;
        startHeroSlider();
    }

    $("detailsClose")?.addEventListener("click", closeTitleDetails);
    $("detailsPlay")?.addEventListener("click", function(){
        if (!detailsMedia) return;
        const media = detailsMedia;
        closeTitleDetails();
        openMedia(media.id, media.media_type, isDubbable(media), getMediaTitle(media), media.poster_path || "");
    });
    $("detailsWatchlist")?.addEventListener("click", async function(){
        if (!detailsMedia) return;
        const id = detailsMedia.id, exists = await dbExists(STORE_WATCHLIST, id);
        if (exists) await dbDelete(STORE_WATCHLIST, id);
        else await dbPut(STORE_WATCHLIST, {id:id,type:getMediaType(detailsMedia),title:getMediaTitle(detailsMedia),poster:detailsMedia.poster_path || "",addedAt:Date.now()});
        setDetailsButtonState($("detailsWatchlist"), !exists);
    });
    $("detailsFavorite")?.addEventListener("click", async function(){
        if (!detailsMedia) return;
        const id = detailsMedia.id, exists = await dbExists(STORE_FAVORITES, id);
        if (exists) await dbDelete(STORE_FAVORITES, id);
        else await dbPut(STORE_FAVORITES, {id:id,type:getMediaType(detailsMedia),title:getMediaTitle(detailsMedia),poster:detailsMedia.poster_path || "",addedAt:Date.now()});
        setDetailsButtonState($("detailsFavorite"), !exists);
    });
    $("detailsDownload")?.addEventListener("click", async function(){
        if (!detailsMedia) return;
        const type = getMediaType(detailsMedia), key = String(detailsMedia.id) + ":" + type, exists = await dbExists(STORE_DOWNLOADS, key);
        if (exists) await dbDelete(STORE_DOWNLOADS, key);
        else await dbPut(STORE_DOWNLOADS, {id:key,mediaId:detailsMedia.id,type:type,title:getMediaTitle(detailsMedia),poster:detailsMedia.poster_path || "",savedAt:Date.now(),note:"Saved to Novex library. Playback download requires an authorized media source."});
        setDetailsButtonState($("detailsDownload"), !exists);
    });
    window.openTitleDetails = openTitleDetails;
    window.closeTitleDetails = closeTitleDetails;

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
        updatePlayerHeader();

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

            const firstSeason = seasons.find(s => s.season_number > 0) || seasons[0];
            const saved = await getSavedContinueItem(currentMedia.id, "tv");
            const savedSeason = saved ? Number(saved.season || 0) : 0;
            const savedEpisode = saved ? Number(saved.episode || 0) : 0;
            const seasonNumber = savedSeason > 0 && seasons.some(s => Number(s.season_number) === savedSeason)
                ? savedSeason : (firstSeason ? firstSeason.season_number : 1);
            currentMedia.currentSeason = seasonNumber;
            if (seasonSelect) seasonSelect.value = String(seasonNumber);
            updateEpisodeDropdown();
            const seasonMeta = seasons.find(s => Number(s.season_number) === Number(seasonNumber));
            const maxEpisode = seasonMeta && Number(seasonMeta.episode_count) > 0 ? Number(seasonMeta.episode_count) : 1;
            const episodeNumber = savedEpisode > 0 && savedEpisode <= maxEpisode ? savedEpisode : 1;
            currentMedia.currentEpisode = episodeNumber;
            if (episodeSelect) episodeSelect.value = String(episodeNumber);
            updatePlayerHeader();
            updatePlayerUrl(seasonNumber, episodeNumber);
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
        updatePlayerHeader();
    }

    async function getSavedContinueItem(mediaId, type) {
        try {
            const items = await getContinueWatching();
            return items.find(item => String(item.mediaId || "").split(":")[0] === String(mediaId) && item.type === type) || null;
        } catch (error) { return null; }
    }

    function updatePlayerHeader() {
        const titleEl = $("playerTitle");
        const episodeEl = $("playerEpisodeLabel");
        if (titleEl) titleEl.textContent = currentMedia.title || "Novex";
        if (episodeEl) episodeEl.textContent = currentMedia.type === "tv" ? "S" + currentMedia.currentSeason + " • E" + currentMedia.currentEpisode : "Movie";
        updatePlayerNavigation();
    }

    function updatePlayerNavigation() {
        const prev = $("playerPrevBtn"), next = $("playerNextBtn");
        if (!prev || !next) return;
        if (currentMedia.type !== "tv") { prev.disabled = true; next.disabled = true; return; }
        const seasons = (currentMedia.seasonsData || []).filter(s => Number(s.season_number) > 0);
        const index = seasons.findIndex(s => Number(s.season_number) === Number(currentMedia.currentSeason));
        const current = index >= 0 ? seasons[index] : null;
        const count = current ? Number(current.episode_count || 0) : 0;
        prev.disabled = currentMedia.currentEpisode <= 1 && index <= 0;
        next.disabled = count > 0 ? currentMedia.currentEpisode >= count && index >= seasons.length - 1 : false;
    }

    async function goToPreviousEpisode() {
        if (currentMedia.type !== "tv") return;
        if (currentMedia.currentEpisode > 1) { if (episodeSelect) episodeSelect.value = String(--currentMedia.currentEpisode); updatePlayerUrl(currentMedia.currentSeason, currentMedia.currentEpisode); await saveContinueWatching(); updatePlayerHeader(); return; }
        const seasons = (currentMedia.seasonsData || []).filter(s => Number(s.season_number) > 0);
        const index = seasons.findIndex(s => Number(s.season_number) === Number(currentMedia.currentSeason));
        if (index > 0) { const season=seasons[index-1]; currentMedia.currentSeason=Number(season.season_number); updateEpisodeDropdown(); const count=Number(season.episode_count||1); currentMedia.currentEpisode=Math.max(1,count); if(seasonSelect) seasonSelect.value=String(currentMedia.currentSeason); if(episodeSelect) episodeSelect.value=String(currentMedia.currentEpisode); updatePlayerUrl(currentMedia.currentSeason,currentMedia.currentEpisode); await saveContinueWatching(); updatePlayerHeader(); }
    }

    async function goToNextEpisode() {
        if (currentMedia.type !== "tv") return;
        const seasons=(currentMedia.seasonsData||[]).filter(s=>Number(s.season_number)>0);
        const index=seasons.findIndex(s=>Number(s.season_number)===Number(currentMedia.currentSeason));
        const current=index>=0?seasons[index]:null, count=current?Number(current.episode_count||0):0;
        if(count>0 && currentMedia.currentEpisode<count){currentMedia.currentEpisode++;if(episodeSelect)episodeSelect.value=String(currentMedia.currentEpisode);updatePlayerUrl(currentMedia.currentSeason,currentMedia.currentEpisode);await saveContinueWatching();updatePlayerHeader();return;}
        if(index>=0 && index<seasons.length-1){currentMedia.currentSeason=Number(seasons[index+1].season_number);currentMedia.currentEpisode=1;if(seasonSelect)seasonSelect.value=String(currentMedia.currentSeason);updateEpisodeDropdown();if(episodeSelect)episodeSelect.value="1";updatePlayerUrl(currentMedia.currentSeason,1);await saveContinueWatching();updatePlayerHeader();}
    }

    $("playerPrevBtn")?.addEventListener("click", goToPreviousEpisode);
    $("playerNextBtn")?.addEventListener("click", goToNextEpisode);

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

    /* =========================================================
       NOVEX 2.0 — SMART SEARCH
       ========================================================= */

    const searchSuggestions = $("searchSuggestions");
    const searchSuggestionsList = $("searchSuggestionsList");
    const searchSuggestionsLabel = $("searchSuggestionsLabel");
    const searchSuggestionsClear = $("searchSuggestionsClear");
    const searchFilterTabs = document.querySelectorAll(".search-filter-tab");

    let searchSuggestionTimer = null;
    let searchSuggestionRequest = 0;
    let searchSuggestionResults = [];
    let searchSuggestionFilter = "all";
    const searchSuggestionCache = new Map();

    function getSearchItemType(item) {
        return item.media_type === "movie" ? "movie" : "tv";
    }

    function isAnimeSearchItem(item) {
        return getSearchItemType(item) === "tv" && (
            item.original_language === "ja" ||
            (Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
        );
    }

    function getSearchItemTitle(item) {
        return item.title || item.name || "Untitled";
    }

    function getSearchItemYear(item) {
        const date = item.release_date || item.first_air_date || "";
        return date ? String(date).slice(0, 4) : "";
    }

    function filterSearchSuggestions(items) {
        if (searchSuggestionFilter === "all") return items;
        if (searchSuggestionFilter === "anime") return items.filter(isAnimeSearchItem);
        return items.filter(item => getSearchItemType(item) === searchSuggestionFilter);
    }

    function renderSearchSuggestions(items, query) {
        if (!searchSuggestionsList) return;
        const filtered = filterSearchSuggestions(items);
        searchSuggestionsList.innerHTML = "";

        if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "search-suggestion-empty";
            empty.textContent = query
                ? "No " + (searchSuggestionFilter === "all" ? "" : searchSuggestionFilter + " ") + "results found."
                : "Start typing to discover movies, series and anime.";
            searchSuggestionsList.appendChild(empty);
            return;
        }

        filtered.slice(0, 8).forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-suggestion-item";

            const poster = document.createElement("img");
            poster.className = "search-suggestion-poster";
            poster.loading = "lazy";
            poster.src = item.poster_path ? getPosterUrl(item.poster_path) : "";
            poster.alt = "";

            const copy = document.createElement("span");
            copy.className = "search-suggestion-copy";

            const title = document.createElement("span");
            title.className = "search-suggestion-title";
            title.textContent = getSearchItemTitle(item);

            const meta = document.createElement("span");
            meta.className = "search-suggestion-meta";
            const year = getSearchItemYear(item);
            const language = item.original_language ? item.original_language.toUpperCase() : "";
            meta.textContent = [year, language].filter(Boolean).join(" • ");

            const type = document.createElement("span");
            type.className = "search-suggestion-type";
            type.textContent = isAnimeSearchItem(item) ? "ANIME" : getSearchItemType(item) === "tv" ? "SERIES" : "MOVIE";
            meta.appendChild(type);
            copy.appendChild(title);
            copy.appendChild(meta);

            const arrow = document.createElement("span");
            arrow.className = "search-suggestion-arrow";
            arrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

            button.appendChild(poster);
            button.appendChild(copy);
            button.appendChild(arrow);

            button.addEventListener("click", () => {
                if (search) search.value = getSearchItemTitle(item);
                saveSearchHistory(getSearchItemTitle(item));
                hideSearchSuggestions();
                if (typeof openTitleDetails === "function") {
                    openTitleDetails(item);
                } else {
                    executeSearch(getSearchItemTitle(item));
                }
            });

            searchSuggestionsList.appendChild(button);
        });
    }

    function showSearchSuggestions() {
        if (searchSuggestions) searchSuggestions.hidden = false;
    }

    function hideSearchSuggestions() {
        if (searchSuggestions) searchSuggestions.hidden = true;
    }

    async function runLiveSearch(query) {
        const cleanQuery = String(query || "").trim();
        if (!cleanQuery) {
            searchSuggestionResults = [];
            hideSearchSuggestions();
            showSearchHistory();
            return;
        }

        if (cleanQuery.length < 2) {
            searchSuggestionResults = [];
            showSearchSuggestions();
            renderSearchSuggestions([], cleanQuery);
            return;
        }

        showSearchSuggestions();
        if (searchSuggestionsLabel) searchSuggestionsLabel.textContent = 'Results for "' + cleanQuery + '"';
        if (searchSuggestionsList) searchSuggestionsList.innerHTML = '<div class="search-suggestion-loading"><i class="fa-solid fa-spinner fa-spin"></i> Finding titles...</div>';

        const requestId = ++searchSuggestionRequest;
        const cacheKey = cleanQuery.toLowerCase();
        if (searchSuggestionCache.has(cacheKey)) {
            searchSuggestionResults = searchSuggestionCache.get(cacheKey);
            if (requestId === searchSuggestionRequest) renderSearchSuggestions(searchSuggestionResults, cleanQuery);
            return;
        }

        const results = await apiFetch("search/multi", { query: cleanQuery, include_adult: false, page: 1 }, []);
        if (requestId !== searchSuggestionRequest) return;

        searchSuggestionResults = results.filter(item =>
            item && item.id && item.poster_path &&
            (item.media_type === "movie" || item.media_type === "tv")
        );
        searchSuggestionCache.set(cacheKey, searchSuggestionResults);
        if (searchSuggestionCache.size > 25) {
            const firstKey = searchSuggestionCache.keys().next().value;
            searchSuggestionCache.delete(firstKey);
        }
        renderSearchSuggestions(searchSuggestionResults, cleanQuery);
    }

    function scheduleLiveSearch() {
        clearTimeout(searchSuggestionTimer);
        searchSuggestionTimer = setTimeout(() => runLiveSearch(search ? search.value : ""), 280);
    }
    /* =========================================================
       NOVEX 2.0 — SURPRISE ME + FULL SEARCH
       ========================================================= */

    const surpriseMePanel = $("surpriseMePanel");
    const surpriseMeButton = $("surpriseMeButton");

    function showSurpriseMe(show = true) {
        if (surpriseMePanel) surpriseMePanel.hidden = !show;
    }

    function getDiscoverType(item) {
        return item && item.media_type === "tv" ? "tv" : "movie";
    }

    function getSearchResultTitle(item) {
        return item.title || item.name || "Untitled";
    }

    function renderFullSearchResults(title, results, filter = "all") {
        if (!contentContainer) return;
        contentContainer.innerHTML = "";
        showSurpriseMe(false);

        const section = document.createElement("section");
        section.className = "media-row-section search-results-section";

        const header = document.createElement("div");
        header.className = "section-header";
        const heading = document.createElement("h2");
        heading.textContent = title;
        header.appendChild(heading);

        const count = document.createElement("span");
        count.className = "search-result-count";
        count.textContent = results.length + " titles";
        header.appendChild(count);
        section.appendChild(header);

        const filtered = results.filter(item => {
            if (filter === "all") return true;
            if (filter === "anime") return isAnimeSearchItem(item);
            return getDiscoverType(item) === filter;
        });

        const grid = document.createElement("div");
        grid.className = "search-results-grid";

        filtered.forEach(item => {
            const card = document.createElement("article");
            card.className = "media-card search-result-card";
            card.tabIndex = 0;

            const image = document.createElement("img");
            image.loading = "lazy";
            image.src = item.poster_path ? getPosterUrl(item.poster_path) : "";
            image.alt = getSearchResultTitle(item);

            const info = document.createElement("div");
            info.className = "search-result-card-info";

            const name = document.createElement("h3");
            name.textContent = getSearchResultTitle(item);

            const meta = document.createElement("span");
            meta.textContent = [
                getSearchItemYear(item),
                isAnimeSearchItem(item) ? "Anime" : getDiscoverType(item) === "tv" ? "Series" : "Movie"
            ].filter(Boolean).join(" • ");

            info.appendChild(name);
            info.appendChild(meta);
            card.appendChild(image);
            card.appendChild(info);

            const open = () => openTitleDetails(item);
            card.addEventListener("click", open);
            card.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open();
                }
            });

            grid.appendChild(card);
        });

        if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "search-suggestion-empty";
            empty.textContent = "No titles match this filter.";
            section.appendChild(empty);
        } else {
            section.appendChild(grid);
        }

        contentContainer.appendChild(section);
    }

    async function runFullSearch(searchTerm) {
        const term = String(searchTerm || "").trim();
        if (!term) return;

        stopHeroSlider();
        hideSearchHistory();
        hideSearchSuggestions();
        saveSearchHistory(term);
        if (search) search.value = term;

        if (contentContainer) {
            contentContainer.innerHTML =
                '<div class="search-suggestion-loading" style="padding:50px"><i class="fa-solid fa-spinner fa-spin"></i> Searching Novex...</div>';
        }

        const results = await apiFetch("search/multi", {
            query: term,
            include_adult: false,
            page: 1
        }, []);

        const valid = results.filter(item =>
            item &&
            item.id &&
            item.poster_path &&
            (item.media_type === "movie" || item.media_type === "tv")
        );

        if (!valid.length) {
            if (contentContainer) {
                contentContainer.innerHTML = "";
                const empty = document.createElement("div");
                empty.className = "search-suggestion-empty";
                empty.style.padding = "60px 20px";
                empty.textContent = 'No results found for "' + term + '". Try another title.';
                contentContainer.appendChild(empty);
            }
            showSurpriseMe(true);
            return;
        }

        renderFullSearchResults('Search Results for "' + term + '"', valid);
    }

    async function surpriseMe() {
        if (surpriseMeButton) {
            surpriseMeButton.disabled = true;
            surpriseMeButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding a pick...';
        }

        try {
            const [trending, movies, tv] = await Promise.all([
                apiFetch("trending/all/week", {}, FALLBACK_MEDIA),
                apiFetch("trending/movie/week", {}, FALLBACK_MOVIES),
                apiFetch("trending/tv/week", {}, FALLBACK_TV)
            ]);

            const pool = [...trending, ...movies, ...tv].filter(item =>
                item && item.id && item.poster_path &&
                (item.media_type === "movie" || item.media_type === "tv")
            );

            const unique = [];
            const seen = new Set();

            pool.forEach(item => {
                const key = String(item.id) + ":" + getDiscoverType(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(item);
                }
            });

            if (!unique.length) return;

            const picked = unique[Math.floor(Math.random() * unique.length)];
            showSurpriseMe(false);
            openTitleDetails(picked);
        } catch (error) {
            console.error("Surprise Me error:", error);
        } finally {
            if (surpriseMeButton) {
                surpriseMeButton.disabled = false;
                surpriseMeButton.innerHTML = '<i class="fa-solid fa-shuffle"></i> Surprise Me';
            }
        }
    }

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

        renderFullSearchResults(
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

                const open = () => openTitleDetails({id:item.mediaId,media_type:item.type || "movie",title:item.title,name:item.title,poster_path:item.poster || ""}, item.type || "movie");

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
        search.addEventListener("focus", () => {
            if (search.value.trim()) scheduleLiveSearch();
            else showSearchHistory();
        });
        search.addEventListener("input", scheduleLiveSearch);
        search.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                hideSearchSuggestions();
                search.blur();
            }
        });
    }

    searchFilterTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            searchFilterTabs.forEach(item => item.classList.remove("active"));
            tab.classList.add("active");
            searchSuggestionFilter = tab.dataset.filter || "all";
            renderSearchSuggestions(searchSuggestionResults, search ? search.value.trim() : "");
        });
    });

    if (searchSuggestionsClear) {
        searchSuggestionsClear.addEventListener("click", () => {
            if (search) {
                search.value = "";
                search.focus();
            }
            searchSuggestionResults = [];
            hideSearchSuggestions();
            showSearchHistory();
        });
    }

    document.addEventListener("click", event => {
        if (!searchSuggestions || !search) return;
        if (!searchSuggestions.contains(event.target) && event.target !== search) {
            hideSearchSuggestions();
        }
    });

    if (form) {
        form.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                const term =
                    search?.value.trim();

                hideSearchSuggestions();

                if (term) {
                    runFullSearch(term);
                } else {
                    loadAllCatalog();
                }
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    document.addEventListener("DOMContentLoaded", () => {
            setupWhatsAppChannelPrompt();

            if (surpriseMeButton) {
                surpriseMeButton.addEventListener("click", surpriseMe);
            }

            loadAllCatalog();
        });

})();


/* =========================================================
   NOVEX WHATSAPP CHANNEL — FIRST VISIT PROMPT
   ========================================================= */
const NOVEX_WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb9JkUrBPzjRTRPSb71Y";
const NOVEX_WHATSAPP_PROMPT_KEY = "novex_whatsapp_prompt_seen";

function setupWhatsAppChannelPrompt() {
    const prompt = document.getElementById("whatsappWelcome");
    const dismiss = document.getElementById("whatsappDismiss");
    if (!prompt) return;

    if (localStorage.getItem(NOVEX_WHATSAPP_PROMPT_KEY) !== "1") {
        prompt.hidden = false;
    }

    if (dismiss) {
        dismiss.addEventListener("click", () => {
            localStorage.setItem(NOVEX_WHATSAPP_PROMPT_KEY, "1");
            prompt.hidden = true;
        });
    }
}

function openNovexWhatsAppChannel() {
    window.open(NOVEX_WHATSAPP_CHANNEL, "_blank", "noopener,noreferrer");
}

window.openNovexWhatsAppChannel = openNovexWhatsAppChannel;

