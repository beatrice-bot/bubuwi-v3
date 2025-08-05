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

    // --- 2. STATE APLIKASI ---
    let currentUser = null;
    let activeListeners = [];
    let currentAnimeData = {}; // Menyimpan data anime (termasuk list episode) saat dibuka

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
        const CACHE_DURATION = 15 * 60 * 1000; // Cache 15 menit
        async function fetchData(target, params = {}) {
            const query = new URLSearchParams({ target, ...params }).toString();
            const cacheKey = `bubuwi_cache_${query}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) return data;
            }
            const response = await fetch(`/.netlify/functions/scrape?${query}`);
            if (!response.ok) throw new Error(`Scraping failed for target: ${target}`);
            const data = await response.json();
            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
            return data;
        }
        return {
            getHome: () => fetchData('home'),
            getEpisodes: (url) => fetchData('episodes', { url: encodeURIComponent(url) }),
            getWatch: (url) => fetchData('watch', { url: encodeURIComponent(url) }),
        };
    })();

    // --- 6. MODUL DATABASE (INTERAKSI DENGAN FIREBASE) ---
    const DB = (() => {
        const listen = (ref, callback) => {
            // Hapus listener sebelumnya di path yang sama jika ada untuk menghindari duplikasi
            const existing = activeListeners.find(l => l.ref.toString() === ref.toString());
            if (existing) existing.ref.off('value', existing.callback);
            activeListeners = activeListeners.filter(l => l.ref.toString() !== ref.toString());
            
            ref.on('value', callback);
            activeListeners.push({ ref, callback });
        };
        return {
            addToHistory: (animeData) => {
                if (!currentUser) return;
                const ref = db.ref(`users/${currentUser.uid}/history/${generateKey(animeData.url)}`);
                ref.set({ title: animeData.title, poster: animeData.poster, url: animeData.url, lastWatched: firebase.database.ServerValue.TIMESTAMP });
            },
            toggleSubscription: (animeData) => {
                if (!currentUser) return;
                const ref = db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(animeData.url)}`);
                ref.once('value', snapshot => snapshot.exists() ? ref.remove() : ref.set(animeData));
            },
            submitComment: (animeUrl, episodeUrl, text) => {
                if (!currentUser || !text.trim()) return;
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`);
                ref.push({
                    uid: currentUser.uid, name: currentUser.displayName, pfp: currentUser.photoURL,
                    text: text, timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            },
            deleteComment: (animeUrl, episodeUrl, commentKey) => {
                if (!currentUser) return;
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}/${commentKey}`);
                ref.once('value', snapshot => {
                    if (snapshot.exists() && snapshot.val().uid === currentUser.uid) ref.remove();
                });
            },
            listenToHistory: (callback) => listen(db.ref(`users/${currentUser.uid}/history`).orderByChild('lastWatched'), callback),
            listenToSubscriptions: (callback) => listen(db.ref(`users/${currentUser.uid}/subscriptions`), callback),
            listenToComments: (animeUrl, episodeUrl, callback) => listen(db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`).orderByChild('timestamp'), callback),
            listenToSingleSubscription: (animeUrl, callback) => listen(db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(animeUrl)}`), callback),
        };
    })();

// === BAGIAN 1 DARI 3 SELESAI ===
// === BAGIAN 2 DARI 3 DIMULAI ===

    // --- 7. MODUL UI (TEMPLATE HTML & RENDER) ---
    const UI = (() => {
        const createAnimeCard = (anime) => `
            <div class="anime-card" data-url="${anime.url}">
                <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
                <div class="title">${anime.episode || anime.title}</div>
            </div>
        `;
        const createEmptyState = (message) => `<div class="card empty-state-card">${message}</div>`;
        const createSkeletonCards = (count = 6) => Array(count).fill('<div class="anime-card skeleton skeleton-card"></div>').join('');

        const templates = {
            home: () => `
                <div id="home-view" class="view">
                    <div class="hero-section">
                        <img src="https://i.pinimg.com/originals/0b/e7/48/0be748204b77ec2211c3230442e468a9.gif" class="hero-bg" alt="Hero Background">
                        <div class="hero-logo-frame"><img src="https://i.imgur.com/9uK2OPw.png" class="hero-logo" alt="Bubuwi Logo"></div>
                        <h2 class="hero-title">Temukan Anime Favoritmu</h2>
                    </div>
                    <div class="search-section card">
                        <input type="text" id="search-input" placeholder="Fitur pencarian belum tersedia...">
                        <button id="search-button" disabled><i class="fas fa-search"></i></button>
                    </div>
                    <div class="content-section" id="trending-section">
                         <h3><i class="fas fa-chart-line"></i> Trending Minggu Ini</h3>
                        <div id="trending-list"></div>
                    </div>
                    <div class="content-section" id="latest-release-section">
                        <h3><i class="fas fa-fire"></i> Baru Rilis</h3>
                        <div class="anime-grid" id="latest-releases-list">${createSkeletonCards(12)}</div>
                    </div>
                </div>`,
            subscribe: () => `
                <div id="subscribe-view" class="view">
                    <div class="view-header card"><h3><i class="fas fa-bookmark"></i> Anime yang Di-subscribe</h3></div>
                    <div id="subscribed-list" class="anime-grid">${createSkeletonCards(6)}</div>
                </div>`,
            history: () => `
                <div id="history-view" class="view">
                    <div class="view-header card"><h3><i class="fas fa-history"></i> Riwayat Tontonan</h3></div>
                    <div id="history-list" class="anime-grid">${createSkeletonCards(6)}</div>
                </div>`,
            account: (user) => `
                <div id="account-view" class="view">
                    <div class="account-logo-card card"><img src="https://i.imgur.com/9uK2OPw.png" alt="Bubuwi Logo" class="account-logo"></div>
                    <div class="account-info-card card">
                        <img src="${user.photoURL}" alt="User Profile" class="profile-pic">
                        <div class="user-details"><h2>${user.displayName}</h2><p>${user.email}</p></div>
                    </div>
                    <div class="developer-contact card">
                        <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-item"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLht-agYy8VEU-3bkfGKEr9sqEe--B8jfA7Q&s" alt="Instagram"><span>@adnanmwa</span></a>
                        <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-item"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrLEt7CpnTRQ1va0on-RGO3aDsgpdlNFUoaw&s" alt="TikTok"><span>@adnansagiri</span></a>
                    </div>
                    <button id="logout-btn" class="logout-button">Logout</button>
                </div>`,
            episode: (data) => `
                <div id="episode-view" class="view">
                    <button class="back-button"><i class="fas fa-arrow-left"></i> Kembali</button>
                    <div id="anime-detail-header" class="card"><img src="${data.poster}" alt="${data.title}"><div class="info"><h2>${data.title}</h2></div></div>
                    <div id="anime-detail-synopsis" class="card synopsis-card"><h4>Sinopsis</h4><p>${data.synopsis || 'Tidak ada sinopsis.'}</p></div>
                    <button id="subscribe-button" class="subscribe-button"><i class="fas fa-plus"></i> Subscribe</button>
                    <div class="episode-list-container card">
                        <h4>Pilih Episode</h4>
                        <div id="episode-list" class="episodes-grid">${data.episodes.map(ep => `<div class="episode-item" data-url="${ep.url}">Eps ${ep.title.match(/\d+/)}</div>`).join('')}</div>
                    </div>
                </div>`,
            watch: (data) => `
                <div id="watch-view" class="view">
                    <button class="back-button"><i class="fas fa-arrow-left"></i> Kembali</button>
                    <div class="video-player-card card"><div class="video-player-container"><iframe id="video-player" src="${data.videoEmbedUrl || ''}" frameborder="0" allowfullscreen></iframe></div></div>
                    <div id="watch-info-box" class="card"><p>${data.episodeTitle}</p></div>
                    <div class="episode-navigation">
                        <button class="nav-btn" ${!data.prevEpisodeUrl ? 'disabled' : ''} data-url="${data.prevEpisodeUrl}">Prev</button>
                        <button class="nav-btn" ${!data.nextEpisodeUrl ? 'disabled' : ''} data-url="${data.nextEpisodeUrl}">Next</button>
                    </div>
                    <div class="episode-list-container-watch card">
                        <h4>Episode Lainnya</h4>
                        <div id="episode-list-watch" class="episodes-grid"></div>
                    </div>
                    <div id="add-comment-container" class="card">
                        <h4>Tambahkan Komentar</h4>
                        <div class="add-comment">
                            <img src="${currentUser.photoURL}" alt="User" class="profile-pic-comment">
                            <input type="text" id="comment-input" placeholder="Tulis komentarmu...">
                            <button id="comment-submit-btn" disabled><i class="fas fa-paper-plane"></i></button>
                        </div>
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
                        <div class="trending-card card" data-url="${data.trending.url}">
                            <img src="${data.trending.poster}" class="poster" alt="${data.trending.title}">
                            <div class="info">
                                <span class="label">Trending</span>
                                <span class="title">${data.trending.title}</span>
                            </div>
                        </div>`;
                }
                document.getElementById('latest-releases-list').innerHTML = data.latest.map(createAnimeCard).join('');
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
                if (!snapshot.exists()) { container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Belum ada komentar.</p>'; return; }
                let comments = []; snapshot.forEach(child => comments.push({ key: child.key, ...child.val() }));
                container.innerHTML = comments.reverse().map(c => `
                    <div class="comment">
                        <img src="${c.pfp}" alt="pfp" class="profile-pic-comment">
                        <div class="comment-content">
                            <p class="username">${c.name}</p>
                            <p>${c.text.replace(/</g, "&lt;")}</p>
                        </div>
                        ${currentUser && currentUser.uid === c.uid ? `<button class="delete-comment-btn" data-anime-url="${animeUrl}" data-episode-url="${episodeUrl}" data-key="${c.key}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>`).join('');
            }
        };
    })();

// === BAGIAN 2 DARI 3 SELESAI ===
// === BAGIAN 3 DARI 3 DIMULAI ===

    // --- 8. VIEW CONTROLLER & EVENT LISTENERS ---
    async function switchView(viewName, params = {}) {
        showLoading(true);
        activeListeners.forEach(l => l.ref.off('value', l.callback));
        activeListeners = [];
        
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
        
        try {
            switch (viewName) {
                case 'home':
                    UI.render('home');
                    const homeData = await API.getHome();
                    UI.renderHomepage(homeData);
                    initGsapAnimations();
                    break;
                case 'subscribe':
                    UI.render('subscribe');
                    DB.listenToSubscriptions(UI.renderSubscriptions);
                    break;
                case 'history':
                    UI.render('history');
                    DB.listenToHistory(UI.renderHistory);
                    break;
                case 'account':
                    UI.render('account', currentUser);
                    break;
                case 'episode':
                    const episodeData = await API.getEpisodes(params.url);
                    currentAnimeData = { ...episodeData, url: params.url };
                    UI.render('episode', currentAnimeData);
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
                    const currentEp = currentAnimeData.episodes.find(ep => ep.url === params.url);
                    UI.render('watch', { ...watchData, episodeTitle: `Episode ${currentEp.title.match(/\d+/)}` });
                    document.getElementById('episode-list-watch').innerHTML = currentAnimeData.episodes.map(ep => `<div class="episode-item" data-url="${ep.url}">Eps ${ep.title.match(/\d+/)}</div>`).join('');
                    DB.addToHistory({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: currentAnimeData.url });
                    DB.listenToComments(currentAnimeData.url, params.url, (snapshot) => UI.renderComments(snapshot, currentAnimeData.url, params.url));
                    break;
            }
        } catch(error) {
            console.error("Error loading view:", viewName, error);
            mainContent.innerHTML = UI.render('history'); // Fallback
        } finally {
            showLoading(false);
        }
    }

    // --- 9. OTENTIKASI & INISIALISASI ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            loginPage.style.display = 'none';
            appContainer.style.display = 'flex';
            switchView('home');
        } else {
            loginPage.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    // --- EVENT LISTENER UTAMA (EVENT DELEGATION) ---
    document.getElementById('login-btn').addEventListener('click', () => auth.signInWithPopup(provider));
    
    document.getElementById('bottom-nav').addEventListener('click', (e) => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) switchView(navButton.dataset.view);
    });

    mainContent.addEventListener('click', (e) => {
        const target = e.target;
        const animeCard = target.closest('.anime-card, .trending-card');
        const episodeItem = target.closest('.episode-item');
        const backButton = target.closest('.back-button');
        const logoutButton = target.closest('#logout-btn');
        const subscribeButton = target.closest('#subscribe-button');
        const navBtn = target.closest('.nav-btn');
        const submitCommentBtn = target.closest('#comment-submit-btn');
        const deleteCommentBtn = target.closest('.delete-comment-btn');

        if (animeCard) switchView('episode', { url: animeCard.dataset.url });
        if (episodeItem) switchView('watch', { url: episodeItem.dataset.url });
        if (backButton) switchView('home');
        if (logoutButton) auth.signOut();
        if (subscribeButton) DB.toggleSubscription({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: currentAnimeData.url });
        if (navBtn && !navBtn.disabled) switchView('watch', { url: navBtn.dataset.url });
        if (submitCommentBtn && !submitCommentBtn.disabled) {
            const commentInput = document.getElementById('comment-input');
            DB.submitComment(currentAnimeData.url, currentAnimeData.episodes.find(ep => document.getElementById('video-player').src.includes(ep.url)).url, commentInput.value);
            commentInput.value = '';
            submitCommentBtn.disabled = true;
        }
        if (deleteCommentBtn) {
            const { animeUrl, episodeUrl, key } = deleteCommentBtn.dataset;
            DB.deleteComment(animeUrl, episodeUrl, key);
        }
    });
    
    mainContent.addEventListener('input', (e) => {
        if (e.target.id === 'comment-input') {
            document.getElementById('comment-submit-btn').disabled = e.target.value.trim() === '';
        }
    });

    function initGsapAnimations() {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(".hero-bg", {
            scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: true },
            y: 100
        });
        ScrollTrigger.batch(".content-section .anime-card, .trending-card", {
            start: "top 90%",
            onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" }),
        });
        ScrollTrigger.refresh();
    }
});
// === BAGIAN 3 DARI 3 SELESAI ===
