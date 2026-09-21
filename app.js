const API_KEY = '4cace2e053c8bc8ae6ed960c3518c853';
const API_URL = `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}`;
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';

const main = document.getElementById('main');
const form = document.getElementById('form');
const search = document.getElementById('search');

// Simulation Mode Fallback Data
const backupMovies = [
    { title: "Deadpool & Wolverine", poster_path: "/8cdWjvZQUrmU11cdq362544n62e.jpg", id: 533535, vote_average: 8.5 },
    { title: "Inside Out 2", poster_path: "/vpnVM9B6NMmQpWeZq2n9a53pBti.jpg", id: 1022789, vote_average: 7.9 },
    { title: "Alien: Romulus", poster_path: "/b33nnKl1GSFbao4l3fZj328K46j.jpg", id: 1226578, vote_average: 7.3 },
    { title: "Despicable Me 4", poster_path: "/wWba3TaojhK7Nhn4GUzWJc5h00e.jpg", id: 519182, vote_average: 7.1 }
];

// Initialize application
getMovies(API_URL);

async function getMovies(url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            showMovies(data.results);
        } else {
            showMovies(backupMovies);
        }
    } catch (error) {
        console.error("API Fetch Failed. Loading Simulation Mode.", error);
        showMovies(backupMovies);
    }
}

function showMovies(movies) {
    if (!main) return;
    main.innerHTML = '';

    movies.forEach((movie) => {
        const { title, poster_path, vote_average, id } = movie;
        const movieEl = document.createElement('div');
        movieEl.classList.add('movie');
        
        const imageSrc = poster_path ? IMG_PATH + poster_path : 'https://via.placeholder.com/500x750?text=No+Image';

        movieEl.innerHTML = `
            <img src="${imageSrc}" alt="${title}">
            <div class="movie-info">
                <h3>${title}</h3>
                <span class="${getClassByRate(vote_average)}">${vote_average ? vote_average.toFixed(1) : 'NR'}</span>
            </div>
        `;
        
        movieEl.addEventListener('click', () => openModal(id));
        main.appendChild(movieEl);
    });
}

function getClassByRate(vote) {
    if (vote >= 8) return 'green';
    else if (vote >= 5) return 'orange';
    else return 'red';
}

function openModal(movieId) {
    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '9999';

    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Close';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.padding = '10px 20px';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.color = 'white';
    closeBtn.style.backgroundColor = 'red';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '5px';
    closeBtn.style.cursor = 'pointer';
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    const iframe = document.createElement('iframe');
    iframe.src = `https://vidsrc.me/embed/movie?tmdb=${movieId}`;
    iframe.style.width = '90%';
    iframe.style.height = '80%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;

    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    document.body.appendChild(modal);
}

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = search.value;
        if (searchTerm && searchTerm !== '') {
            getMovies(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${searchTerm}`);
            search.value = '';
        } else {
            window.location.reload();
        }
    });
}