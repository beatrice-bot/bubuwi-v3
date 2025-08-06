// === BAGIAN 1 DARI 3 DIMULAI ===
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. KONFIGURASI & INISIALISASI ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
        authDomain: "bubuwi-pro.firebaseapp.com",
        projectId: "bubuwi-pro",
        databaseURL: "https://bubuwi-pro-default-rtdb.asia-southeast1.firebasedata.app",
        storageBucket: "bubuwi-pro.appspot.com",
        messagingSenderId: "741891119074",
        appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- 2. STATE APLIKASI (SUMBER KEBENARAN) ---
    const state = {
        currentUser: null,
        currentAnime: {}, // Menyimpan data anime yang sedang dibuka (untuk halaman episode & nonton)
        activeListeners: [] // Menyimpan semua listener aktif agar bisa dimatikan
    };

    // --- 3. ELEMEN UTAMA ---
    const mainContent = document.getElementById('main-content');
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- 4. FUNGSI UTILITAS ---
    const showLoading = (isLoading) => { loadingOverlay.style.display = isLoading ? 'flex' : 'none'; };
    const generateKey = (str) => str ? str.replace(/[.#$[\]]/g, '_') : Date.now().toString();

    // --- 5. MODUL API (MENGAMBIL DATA DARI SCRAPER) ---
    const API = (() => {
        const CACHE_DURATION = 3 * 60 * 60 * 1000; // Cache 3 jam untuk halaman utama
        async function fetchData(target, params = {}) {
            const query = new URLSearchParams({ target, ...params }).toString();
            const useCache = target === 'home';
            const cacheKey = `bubuwi_cache_${query}`;

            if (useCache) {
                try {
                    const cached = sessionStorage.getItem(cacheKey);
                    if (cached) {
                        const { timestamp, data } = JSON.parse(cached);
                        if (Date.now() - timestamp < CACHE_DURATION) return data;
                    }
                } catch (e) { console.error("Gagal membaca cache:", e); }
            }
            
            const response = await fetch(`/api/scrape?${query}`);
            if (!response.ok) throw new Error(`Scraping failed for target: ${target}`);
            const data = await response.json();

            if (useCache) {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
                } catch (e) { console.error("Gagal menyimpan cache:", e); }
            }
            return data;
        }
        return {
            getHome: () => fetchData('home'),
            getEpisodes: (url) => fetchData('episodes', { url: encodeURIComponent(url) }),
            getWatch: (url) => fetchData('watch', { url: encodeURIComponent(url) }),
            search: (query) => fetchData('search', { query: encodeURIComponent(query) })
        };
    })();

    // --- 6. MODUL DATABASE (INTERAKSI DENGAN FIREBASE) ---
    const DB = (() => {
        const listen = (ref, callback) => {
            const existing = state.activeListeners.find(l => l.ref.toString() === ref.toString());
            if (existing) existing.ref.off('value', existing.callback);
            state.activeListeners = state.activeListeners.filter(l => l.ref.toString() !== ref.toString());
            
            ref.on('value', callback);
            state.activeListeners.push({ ref, callback });
        };
        return {
            addToHistory: (animeData, episodeData) => {
                if (!state.currentUser) return;
                const ref = db.ref(`users/${state.currentUser.uid}/history/${generateKey(animeData.url)}`);
                ref.set({ 
                    title: animeData.title, 
                    poster: animeData.poster, 
                    url: animeData.url, 
                    episode: `Eps ${(episodeData.title.match(/\d+/) || ['?'])[0]}`,
                    lastWatched: firebase.database.ServerValue.TIMESTAMP 
                });
            },
            toggleSubscription: (animeData) => {
                if (!state.currentUser) return;
                const ref = db.ref(`users/${state.currentUser.uid}/subscriptions/${generateKey(animeData.url)}`);
                ref.once('value', snapshot => snapshot.exists() ? ref.remove() : ref.set({
                    title: animeData.title,
                    poster: animeData.poster,
                    url: animeData.url
                }));
            },
            submitComment: (animeUrl, episodeUrl, text) => {
                if (!state.currentUser || !text.trim()) return;
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`);
                ref.push({
                    uid: state.currentUser.uid, name: state.currentUser.displayName, pfp: state.currentUser.photoURL,
                    text: text, timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            },
            deleteComment: (animeUrl, episodeUrl, commentKey) => {
                if (!state.currentUser) return;
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}/${commentKey}`);
                ref.once('value', snapshot => {
                    if (snapshot.exists() && snapshot.val().uid === state.currentUser.uid) ref.remove();
                });
            },
            listenToHistory: (callback) => listen(db.ref(`users/${state.currentUser.uid}/history`).orderByChild('lastWatched'), callback),
            listenToSubscriptions: (callback) => listen(db.ref(`users/${state.currentUser.uid}/subscriptions`), callback),
            listenToComments: (animeUrl, episodeUrl, callback) => listen(db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`).orderByChild('timestamp'), callback),
            listenToSingleSubscription: (animeUrl, callback) => listen(db.ref(`users/${state.currentUser.uid}/subscriptions/${generateKey(animeUrl)}`), callback),
        };
    })();

// === BAGIAN 1 DARI 3 SELESAI ===
// === BAGIAN 2 DARI 3 DIMULAI ===

    // --- 7. MODUL UI (TEMPLATE & RENDERER) ---
    const UI = (() => {
        const createAnimeCard = (anime) => `
            <div class="anime-card" data-action="view-episodes" data-url="${anime.url}">
                <img src="${anime.poster || 'https://via.placeholder.com/247x350.png?text=Bubuwi'}" alt="${anime.title}" loading="lazy">
                <div class="title">${(anime.episode || anime.title).replace('Subtitle Indonesia', '')}</div>
            </div>`;
            
        const createEmptyState = (message) => `<div class="card empty-state-card">${message}</div>`;
        const createSkeletonCards = (count = 12) => Array(count).fill('<div class="anime-card skeleton skeleton-card"></div>').join('');

        const templates = {
            home: () => `
                <div id="home-view" class="view">
                    <div class="hero-section" style="background-image: url('https://i.pinimg.com/originals/0b/e7/48/0be748204b77ec2211c3230442e468a9.gif')">
                        <div class="hero-overlay"></div>
                        <div class="hero-logo-frame"><img src="https://i.imgur.com/9uK2OPw.png" class="hero-logo" alt="Bubuwi Logo"></div>
                        <h2 class="hero-title">Temukan Anime Favoritmu</h2>
                    </div>
                    <form class="search-form card" data-action="search">
                        <input type="text" id="search-input" name="query" placeholder="Cari anime..." required>
                        <button id="search-button" type="submit"><i class="fas fa-search"></i></button>
                    </form>
                    <div class="content-section" id="history-preview-section" style="display: none;">
                        <h3><i class="fas fa-history"></i> Terakhir Ditonton</h3>
                        <div class="anime-grid" id="home-history-list"></div>
                    </div>
                    <div class="content-section" id="trending-section">
                         <h3><i class="fas fa-chart-line"></i> Trending Minggu Ini</h3>
                        <div id="trending-list">${createSkeletonCards(1)}</div>
                    </div>
                    <div class="content-section" id="latest-release-section">
                        <h3><i class="fas fa-fire"></i> Baru Rilis</h3>
                        <div class="anime-grid" id="latest-releases-list">${createSkeletonCards(12)}</div>
                    </div>
                </div>`,
            search: (query) => `
                <div id="search-view" class="view">
                    <button class="back-button" data-action="go-home"><i class="fas fa-arrow-left"></i> Kembali</button>
                    <div class="view-header card"><h3>Hasil Pencarian untuk "${query}"</h3></div>
                    <div id="search-results-list" class="anime-grid">${createSkeletonCards(9)}</div>
                </div>
            `,
            subscribe: () => `<div id="subscribe-view" class="view"><div class="view-header card"><h3><i class="fas fa-bookmark"></i> Anime yang Di-subscribe</h3></div><div id="subscribed-list" class="anime-grid">${createSkeletonCards(6)}</div></div>`,
            account: (user) => `
                <div id="account-view" class="view">
                    <div class="account-logo-card card"><img src="https://i.imgur.com/9uK2OPw.png" alt="Bubuwi Logo" class="account-logo"></div>
                    <div class="account-info-card card">
                        <img src="${user.photoURL}" alt="User Profile" class="profile-pic">
                        <div class="user-details"><h2>${user.displayName}</h2><p>${user.email}</p></div>
                    </div>
                    <div class="developer-contact card">
                        <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-item">
                            <div class="contact-item-logo-wrapper"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZixwpxim0dp6v2ibyW9RZ5L6UjI3GMBqPZA&s" alt="Instagram" class="contact-item-logo"></div>
                            <span>@adnanmwa</span>
                        </a>
                        <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-item">
                            <div class="contact-item-logo-wrapper"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok" class="contact-item-logo"></div>
                            <span>@adnansagiri</span>
                        </a>
                    </div>
                    <button data-action="logout" class="logout-button">Logout</button>
                </div>`,
            episode: (data) => `
                <div id="episode-view" class="view">
                    <button class="back-button" data-action="go-home"><i class="fas fa-arrow-left"></i> Kembali</button>
                    <div id="anime-detail-header" class="card"><img src="${data.poster}" alt="${data.title}"><div class="info"><h2>${data.title}</h2></div></div>
                    <div id="anime-detail-synopsis" class="card synopsis-card"><h4>Sinopsis</h4><p>${data.synopsis || 'Tidak ada sinopsis.'}</p></div>
                    <button id="subscribe-button" class="subscribe-button" data-action="subscribe"><i class="fas fa-plus"></i> Subscribe</button>
                    <div class="episode-list-container card">
                        <h4>Pilih Episode</h4>
                        <div id="episode-list" class="episodes-grid">${data.episodes.map(ep => `<div class="episode-item" data-action="watch" data-url="${ep.url}">Eps ${(ep.title.match(/\d+/) || ['?'])[0]}</div>`).join('')}</div>
                    </div>
                </div>`,
            watch: (data) => `
                <div id="watch-view" class="view">
                    <button class="back-button" data-action="go-to-episodes"><i class="fas fa-arrow-left"></i> Kembali ke Daftar Episode</button>
                    <div class="video-player-card card"><div class="video-player-container"><iframe id="video-player" src="${data.videoEmbedUrl || ''}" frameborder="0" allowfullscreen></iframe></div></div>
                    <div id="watch-info-box" class="card"><p>${data.episodeTitle}</p></div>
                    <div class="episode-navigation">
                        <button class="nav-btn" ${!data.prevEpisodeUrl ? 'disabled' : ''} data-action="watch" data-url="${data.prevEpisodeUrl || ''}">Prev</button>
                        <button class="nav-btn" ${!data.nextEpisodeUrl ? 'disabled' : ''} data-action="watch" data-url="${data.nextEpisodeUrl || ''}">Next</button>
                    </div>
                    <div class="episode-list-container-watch card">
                        <h4>Episode Lainnya</h4>
                        <div id="episode-list-watch" class="episodes-grid"></div>
                    </div>
                    <div id="add-comment-container" class="card">
                        <h4>Tambahkan Komentar</h4>
                        <form id="comment-form" data-action="submit-comment">
                            <img src="${state.currentUser.photoURL}" alt="User" class="profile-pic-comment">
                            <input type="text" id="comment-input" name="comment" placeholder="Tulis komentarmu..." required autocomplete="off">
                            <button id="comment-submit-btn" type="submit" disabled><i class="fas fa-paper-plane"></i></button>
                        </form>
                    </div>
                    <div id="comments-list-container" class="card"><h4>Komentar</h4><div id="comments-list"></div></div>
                </div>`,
        };

        return {
            render: (view, data = {}) => {
                mainContent.innerHTML = templates[view](data);
            },
            renderHomepage: (data) => {
                if (data.trending && data.trending.url) {
                    document.getElementById('trending-list').innerHTML = `
                        <div class="trending-card card" data-action="view-episodes" data-url="${data.trending.url}">
                            <img src="${data.trending.poster}" class="poster" alt="${data.trending.title}">
                            <div class="info">
                                <span class="label">Trending</span>
                                <span class="title">${data.trending.title}</span>
                            </div>
                        </div>`;
                } else {
                     document.getElementById('trending-section').style.display = 'none';
                }
                document.getElementById('latest-releases-list').innerHTML = data.latest.map(createAnimeCard).join('');
            },
            renderHistoryPreview: (snapshot) => {
                const container = document.getElementById('home-history-list');
                const section = document.getElementById('history-preview-section');
                if (!container || !snapshot.exists()) {
                    if(section) section.style.display = 'none';
                    return;
                }
                section.style.display = 'block';
                let history = []; snapshot.forEach(child => history.push(child.val()));
                container.innerHTML = history.reverse().slice(0, 3).map(createAnimeCard).join('');
            },
            renderHistory: (snapshot) => {
                const container = document.getElementById('history-list');
                if (!snapshot.exists()) { container.innerHTML = createEmptyState("Riwayat tontonanmu masih kosong."); return; }
                let history = []; snapshot.forEach(child => history.push(child.val()));
                container.innerHTML = history.reverse().map(createAnimeCard).join('');
            },
            renderSubscriptions: (snapshot) => {
                const container = document.getElementById('subscribed-list');
                if (!snapshot.exists()) { container.innerHTML = createEmptyState("Kamu belum subscribe anime apapun."); return; }
                let subs = []; snapshot.forEach(child => subs.push(child.val()));
                container.innerHTML = subs.map(createAnimeCard).join('');
            },
            renderComments: (snapshot, animeUrl, episodeUrl) => {
                const container = document.getElementById('comments-list');
                if (!container) return;
                if (!snapshot.exists()) { container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Belum ada komentar.</p>'; return; }
                let comments = []; snapshot.forEach(child => comments.push({ key: child.key, ...child.val() }));
                container.innerHTML = comments.reverse().map(c => `
                    <div class="comment">
                        <img src="${c.pfp}" alt="pfp" class="profile-pic-comment">
                        <div class="comment-content"><p class="username">${c.name}</p><p>${c.text.replace(/</g, "&lt;")}</p></div>
                        ${state.currentUser && state.currentUser.uid === c.uid ? `<button class="delete-comment-btn" data-action="delete-comment" data-key="${c.key}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>`).join('');
            },
            renderSearchResults: (results) => {
                const container = document.getElementById('search-results-list');
                if (!results || results.length === 0) {
                    container.innerHTML = createEmptyState("Anime tidak ditemukan.");
                    return;
                }
                container.innerHTML = results.map(createAnimeCard).join('');
            }
        };
    })();

// === BAGIAN 2 DARI 3 SELESAI ===
// === BAGIAN 3 DARI 3 DIMULAI ===

    // --- 8. VIEW CONTROLLER & INISIALISASI ---
    async function switchView(viewName, params = {}) {
        showLoading(true);
        activeListeners.forEach(l => l.ref.off('value', l.callback));
        activeListeners = [];
        
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
        
        try {
            switch (viewName) {
                case 'home':
                    UI.render('home');
                    DB.listenToHistory(UI.renderHistoryPreview);
                    const homeData = await API.getHome();
                    UI.renderHomepage(homeData);
                    initGsapAnimations();
                    break;
                case 'search':
                    UI.render('search', params.query);
                    const searchResults = await API.search(params.query);
                    UI.renderSearchResults(searchResults);
                    break;
                case 'subscribe':
                    UI.render('subscribe');
                    DB.listenToSubscriptions(UI.renderSubscriptions);
                    break;
                case 'account':
                    UI.render('account', state.currentUser);
                    break;
                case 'episode':
                    const episodeData = await API.getEpisodes(params.url);
                    state.currentAnime = { ...episodeData, url: params.url };
                    UI.render('episode', state.currentAnime);
                    DB.listenToSingleSubscription(params.url, snapshot => {
                        const subBtn = document.getElementById('subscribe-button');
                        if (subBtn) {
                            if (snapshot.exists()) {
                                subBtn.innerHTML = '<i class="fas fa-check"></i> Subscribed';
                                subBtn.classList.add('active');
                            } else {
                                subBtn.innerHTML = '<i class="fas fa-plus"></i> Subscribe';
                                subBtn.classList.remove('active');
                            }
                        }
                    });
                    break;
                case 'watch':
                    const watchData = await API.getWatch(params.url);
                    const currentEp = state.currentAnime.episodes.find(ep => ep.url === params.url);
                    UI.render('watch', { ...watchData, episodeTitle: `Episode ${(currentEp.title.match(/\d+/) || ['?'])[0]}` });
                    document.getElementById('episode-list-watch').innerHTML = state.currentAnime.episodes.map(ep => `<div class="episode-item" data-action="watch" data-url="${ep.url}">Eps ${(ep.title.match(/\d+/) || ['?'])[0]}</div>`).join('');
                    DB.addToHistory({ title: state.currentAnime.title, poster: state.currentAnime.poster, url: state.currentAnime.url }, currentEp);
                    DB.listenToComments(state.currentAnime.url, params.url, (snapshot) => UI.renderComments(snapshot, state.currentAnime.url, params.url));
                    break;
            }
        } catch(error) {
            console.error("Error loading view:", viewName, error);
            mainContent.innerHTML = UI.render('subscribe'); // Fallback ke halaman subscribe jika error
        } finally {
            showLoading(false);
        }
    }
    
    auth.onAuthStateChanged(user => {
        state.currentUser = user;
        if (user) {
            loginPage.style.display = 'none';
            appContainer.style.display = 'flex';
            switchView('home');
        } else {
            loginPage.style.display = 'flex';
            appContainer.style.display = 'none';
            activeListeners.forEach(l => l.ref.off('value', l.callback));
            activeListeners = [];
        }
    });

    // --- EVENT LISTENERS UTAMA (EVENT DELEGATION) ---
    document.getElementById('login-btn').addEventListener('click', () => auth.signInWithPopup(provider).catch(err => console.error("Login popup error:", err)));
    
    
    document.getElementById('bottom-nav').addEventListener('click', (e) => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) switchView(navButton.dataset.view);
    });

    mainContent.addEventListener('click', (e) => {
        const target = e.target;
        const actionTarget = target.closest('[data-action]');
        if (!actionTarget) return;

        const { action, url, key } = actionTarget.dataset;

        switch(action) {
            case 'view-episodes':
                switchView('episode', { url });
                break;
            case 'watch':
                if (url && !target.closest('.nav-btn[disabled]')) switchView('watch', { url });
                break;
            case 'go-home':
                switchView('home');
                break;
            case 'go-to-episodes':
                switchView('episode', { url: state.currentAnime.url });
                break;
            case 'logout':
                auth.signOut();
                break;
            case 'subscribe':
                DB.toggleSubscription({ title: state.currentAnime.title, poster: state.currentAnime.poster, url: state.currentAnime.url });
                break;
            case 'delete-comment':
                const watchView = document.getElementById('watch-view');
                if (watchView) {
                    const activeEpisodeUrl = state.currentAnime.episodes.find(ep => document.getElementById('video-player').src.includes(ep.url)).url;
                    DB.deleteComment(state.currentAnime.url, activeEpisodeUrl, key);
                }
                break;
        }
    });
    
    mainContent.addEventListener('submit', (e) => {
        e.preventDefault();
        const action = e.target.dataset.action;
        if (action === 'search') {
            const query = e.target.querySelector('input[name="query"]').value;
            if (query.trim()) switchView('search', { query: query.trim() });
        }
        if (action === 'submit-comment') {
            const commentInput = document.getElementById('comment-input');
            const commentText = commentInput.value;
            const episodeUrl = state.currentAnime.episodes.find(ep => document.getElementById('video-player').src.includes(ep.url)).url;
            DB.submitComment(state.currentAnime.url, episodeUrl, commentText);
            commentInput.value = '';
            document.getElementById('comment-submit-btn').disabled = true;
        }
    });

    mainContent.addEventListener('input', (e) => {
        if (e.target.id === 'comment-input') {
            document.getElementById('comment-submit-btn').disabled = e.target.value.trim() === '';
        }
    });

    function initGsapAnimations() {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(".hero-section", {
            scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 0.5 },
            backgroundPosition: "center 80%"
        });
        ScrollTrigger.batch(".content-section .anime-card, .trending-card", {
            start: "top 95%",
            onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" }),
        });
    }
    
});
// === BAGIAN 3 DARI 3 SELESAI ===
