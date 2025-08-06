// === BAGIAN 1 DARI 2 DIMULAI ===
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. KONFIGURASI & INISIALISASI ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk", authDomain: "bubuwi-pro.firebaseapp.com",
        projectId: "bubuwi-pro", databaseURL: "https://bubuwi-pro-default-rtdb.asia-southeast1.firebasedata.app",
        storageBucket: "bubuwi-pro.appspot.com", messagingSenderId: "741891119074", appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- 2. STATE APLIKASI ---
    let currentUser = null;
    let currentAnimeData = {};
    let activeListeners = [];

    // --- 3. ELEMEN UTAMA ---
    const mainContent = document.getElementById('main-content');
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- 4. FUNGSI-FUNGSI ---
    const showLoading = (isLoading) => { loadingOverlay.style.display = isLoading ? 'flex' : 'none'; };
    const generateKey = (str) => str ? str.replace(/[.#$[\]]/g, '_') : Date.now().toString();
    const getEpNum = (title) => (title.match(/\d+/) || ['?'])[0];

    const API = {
        fetchData: async (target, params = {}) => {
            const query = new URLSearchParams({ target, ...params }).toString();
            showLoading(true);
            try {
                const response = await fetch(`/api/scrape?${query}`);
                if (!response.ok) throw new Error(`Scraping failed`);
                return await response.json();
            } catch (error) {
                console.error(`API Error on ${target}:`, error);
                mainContent.innerHTML = UI.templates.error(`Gagal memuat data. Periksa koneksi atau coba lagi.`);
                return null;
            } finally {
                showLoading(false);
            }
        }
    };

    const DB = {
        listen: (ref, callback) => {
            const existing = activeListeners.find(l => l.ref.toString() === ref.toString());
            if (existing) existing.ref.off('value', existing.callback);
            activeListeners = activeListeners.filter(l => l.ref.toString() !== ref.toString());
            ref.on('value', callback);
            activeListeners.push({ ref, callback });
        },
        addToHistory: (anime, episode) => {
            if (!currentUser) return;
            const ref = db.ref(`users/${currentUser.uid}/history/${generateKey(anime.url)}`);
            ref.set({ title: anime.title, poster: anime.poster, url: anime.url, episode: `Eps ${getEpNum(episode.title)}`, lastWatched: firebase.database.ServerValue.TIMESTAMP });
        },
        toggleSubscription: (anime) => {
            if (!currentUser) return;
            const ref = db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(anime.url)}`);
            ref.once('value', snapshot => snapshot.exists() ? ref.remove() : ref.set(anime));
        },
        submitComment: (animeUrl, episodeUrl, text) => {
            if (!currentUser || !text.trim()) return;
            const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`);
            ref.push({ uid: currentUser.uid, name: currentUser.displayName, pfp: currentUser.photoURL, text, timestamp: firebase.database.ServerValue.TIMESTAMP });
        },
        deleteComment: (animeUrl, episodeUrl, key) => {
            if (!currentUser) return;
            const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}/${key}`);
            ref.once('value', snapshot => {
                if (snapshot.exists() && snapshot.val().uid === currentUser.uid) ref.remove();
            });
        },
    };

    const UI = {
        templates: {
            home: `
                <div class="hero-section" style="background-image: url('https://i.pinimg.com/originals/0b/e7/48/0be748204b77ec2211c3230442e468a9.gif');">
                    <div class="hero-overlay"></div>
                    <div class="hero-logo-frame"><img src="https://i.imgur.com/9uK2OPw.png" class="hero-logo" alt="Bubuwi Logo"></div>
                    <h2 class="hero-title">Temukan Anime Favoritmu</h2>
                </div>
                <form class="search-form card" data-action="search"><input type="text" id="search-input" name="query" placeholder="Pencarian belum aktif..." required><button id="search-button" type="submit" disabled><i class="fas fa-search"></i></button></form>
                <div class="content-section" id="history-preview-section" style="display: none;"><h3><i class="fas fa-history"></i> Terakhir Ditonton</h3><div class="anime-grid" id="home-history-list"></div></div>
                <div class="content-section" id="trending-section"><h3><i class="fas fa-chart-line"></i> Trending Minggu Ini</h3><div id="trending-list"></div></div>
                <div class="content-section" id="latest-release-section"><h3><i class="fas fa-fire"></i> Baru Rilis</h3><div class="anime-grid" id="latest-releases-list"></div></div>
            `,
            account: (user) => `
                <div class="account-logo-card card"><img src="https://i.imgur.com/9uK2OPw.png" alt="Bubuwi Logo" class="account-logo"></div>
                <div class="account-info-card card"><img src="${user.photoURL}" alt="User Profile" class="profile-pic"><div class="user-details"><h2>${user.displayName}</h2><p>${user.email}</p></div></div>
                <div class="developer-contact card">
                    <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-item"><div class="contact-item-logo-wrapper"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZixwpxim0dp6v2ibyW9RZ5L6UjI3GMBqPZA&s" alt="Instagram" class="contact-item-logo"></div><span>@adnanmwa</span></a>
                    <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-item"><div class="contact-item-logo-wrapper"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok" class="contact-item-logo"></div><span>@adnansagiri</span></a>
                </div>
                <button data-action="logout" class="logout-button">Logout</button>
            `,
            subscribe: `<div class="view-header card"><h3><i class="fas fa-bookmark"></i> Anime yang Di-subscribe</h3></div><div id="subscribed-list" class="anime-grid"></div>`,
            episode: (data) => `
                <button class="back-button" data-action="go-home"><i class="fas fa-arrow-left"></i> Kembali</button>
                <div id="anime-detail-header" class="card"><img src="${data.poster}"><div class="info"><h2>${data.title}</h2></div></div>
                <div id="anime-detail-synopsis" class="card synopsis-card"><h4>Sinopsis</h4><p>${data.synopsis || 'Tidak ada sinopsis.'}</p></div>
                <button id="subscribe-button" class="subscribe-button" data-action="subscribe"><i class="fas fa-plus"></i> Subscribe</button>
                <div class="episode-list-container card"><h4>Pilih Episode</h4><div id="episode-list" class="episodes-grid">${data.episodes.map(ep => `<div class="episode-item" data-action="watch" data-url="${ep.url}">Eps ${getEpNum(ep.title)}</div>`).join('')}</div></div>
            `,
            watch: (data) => `
                <button class="back-button" data-action="go-to-episodes"><i class="fas fa-arrow-left"></i> Kembali</button>
                <div class="video-player-card card"><div class="video-player-container"><iframe src="${data.videoEmbedUrl || ''}" frameborder="0" allowfullscreen></iframe></div></div>
                <div id="watch-info-box" class="card"><p>${data.episodeTitle}</p></div>
                <div class="episode-navigation">
                    <button class="nav-btn" ${!data.prevEpisodeUrl ? 'disabled' : ''} data-action="watch" data-url="${data.prevEpisodeUrl || ''}">Prev</button>
                    <button class="nav-btn" ${!data.nextEpisodeUrl ? 'disabled' : ''} data-action="watch" data-url="${data.nextEpisodeUrl || ''}">Next</button>
                </div>
                <div class="episode-list-container-watch card"><h4>Episode Lainnya</h4><div id="episode-list-watch" class="episodes-grid"></div></div>
                <div id="add-comment-container" class="card"><h4>Komentar</h4><form id="comment-form" data-action="submit-comment"><img src="${currentUser.photoURL}" class="profile-pic-comment"><input type="text" id="comment-input" name="comment" required autocomplete="off"><button id="comment-submit-btn" type="submit" disabled><i class="fas fa-paper-plane"></i></button></form></div>
                <div id="comments-list-container" class="card"><h4>Komentar</h4><div id="comments-list"></div></div>
            `,
            error: (message) => `<div class="card empty-state-card">${message}</div>`,
        },
        createCard: (anime) => `<div class="anime-card" data-action="view-episodes" data-url="${anime.url}"><img src="${anime.poster || 'https://via.placeholder.com/247x350.png?text=Bubuwi'}" loading="lazy"><div class="title">${anime.episode || anime.title}</div></div>`,
    };

// === BAGIAN 1 DARI 2 SELESAI ===
// === BAGIAN 2 DARI 2 DIMULAI ===

    function renderView(viewName, data) {
        mainContent.innerHTML = UI.templates[viewName](data);
    }
    
    function initGsapAnimations() {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(".hero-section", { scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 0.5 }, backgroundPosition: "center 80%" });
        ScrollTrigger.batch(".content-section .anime-card, .trending-card", {
            start: "top 95%", onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" }),
        });
    }

    async function switchView(viewName, params = {}) {
        activeListeners.forEach(l => l.ref.off());
        activeListeners = [];
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
        
        switch (viewName) {
            case 'home':
                renderView('home');
                const homeData = await API.fetchData('home');
                if (homeData) {
                    const trendingList = document.getElementById('trending-list');
                    if (homeData.trending?.url) {
                        trendingList.innerHTML = `<div class="trending-card card" data-action="view-episodes" data-url="${homeData.trending.url}"><img src="${homeData.trending.poster}" class="poster"><div class="info"><span class="label">Trending</span><span class="title">${homeData.trending.title}</span></div></div>`;
                    } else {
                        document.getElementById('trending-section').style.display = 'none';
                    }
                    document.getElementById('latest-releases-list').innerHTML = homeData.latest.map(UI.createCard).join('');
                    initGsapAnimations();
                    DB.listen(db.ref(`users/${currentUser.uid}/history`).orderByChild('lastWatched'), (snap) => {
                        const preview = document.getElementById('history-preview-section');
                        const list = document.getElementById('home-history-list');
                        if (!preview || !snap.exists()) { if(preview) preview.style.display = 'none'; return; }
                        preview.style.display = 'block';
                        let history = []; snap.forEach(c => history.push(c.val()));
                        list.innerHTML = history.reverse().slice(0, 3).map(UI.createCard).join('');
                    });
                }
                break;
            case 'subscribe':
                renderView('subscribe');
                DB.listen(db.ref(`users/${currentUser.uid}/subscriptions`), (snap) => {
                    const list = document.getElementById('subscribed-list');
                    if (!list) return;
                    if(!snap.exists()) { list.innerHTML = UI.templates.error("Belum ada langganan."); return; }
                    let subs = []; snap.forEach(c => subs.push(c.val()));
                    list.innerHTML = subs.map(UI.createCard).join('');
                });
                break;
            case 'account':
                renderView('account', currentUser);
                break;
            case 'episode':
                renderView('episode', { poster: 'https://via.placeholder.com/120x170.png?text=?', title: 'Memuat...', episodes: [] });
                const epData = await API.fetchData('episodes', { url: params.url });
                if (epData) {
                    currentAnimeData = { ...epData, url: params.url };
                    renderView('episode', currentAnimeData);
                    DB.listen(db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(params.url)}`), snap => {
                        const subBtn = document.getElementById('subscribe-button');
                        if (subBtn) {
                            subBtn.innerHTML = snap.exists() ? '<i class="fas fa-check"></i> Subscribed' : '<i class="fas fa-plus"></i> Subscribe';
                            subBtn.classList.toggle('active', snap.exists());
                        }
                    });
                }
                break;
            case 'watch':
                renderView('watch', { episodeTitle: 'Memuat...' });
                const watchData = await API.fetchData('watch', { url: params.url });
                if (watchData) {
                    const currentEp = currentAnimeData.episodes.find(ep => ep.url === params.url);
                    renderView('watch', { ...watchData, episodeTitle: `Eps ${getEpNum(currentEp.title)}` });
                    document.getElementById('episode-list-watch').innerHTML = currentAnimeData.episodes.map(ep => `<div class="episode-item" data-action="watch" data-url="${ep.url}">Eps ${getEpNum(ep.title)}</div>`).join('');
                    DB.addToHistory(currentAnimeData, currentEp);
                    DB.listen(db.ref(`comments/${generateKey(currentAnimeData.url)}/${generateKey(params.url)}`).orderByChild('timestamp'), (snap) => {
                        const list = document.getElementById('comments-list');
                        if (!list) return;
                        if (!snap.exists()) { list.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Belum ada komentar.</p>'; return; }
                        let comments = []; snap.forEach(c => comments.push({ key: c.key, ...c.val() }));
                        list.innerHTML = comments.reverse().map(c => `
                            <div class="comment">
                                <img src="${c.pfp}" class="profile-pic-comment">
                                <div class="comment-content"><p class="username">${c.name}</p><p>${c.text.replace(/</g, "&lt;")}</p></div>
                                ${currentUser?.uid === c.uid ? `<button class="delete-comment-btn" data-action="delete-comment" data-key="${c.key}"><i class="fas fa-trash"></i></button>` : ''}
                            </div>`).join('');
                    });
                }
                break;
        }
    }

    // --- INISIALISASI & EVENT DELEGATION ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            loginPage.style.display = 'none';
            appContainer.style.display = 'flex';
            switchView('home');
        } else {
            loginPage.style.display = 'flex';
            appContainer.style.display = 'none';
            activeListeners.forEach(l => l.ref.off());
        }
    });

    document.getElementById('login-btn').addEventListener('click', () => auth.signInWithPopup(provider).catch(err => console.error("Login popup error:", err)));

    appContainer.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const { action, url, key } = target.dataset;

        switch (action) {
            case 'view-episodes': if (url) switchView('episode', { url }); break;
            case 'watch': if (url && !target.disabled) switchView('watch', { url }); break;
            case 'go-home': switchView('home'); break;
            case 'go-to-episodes': switchView('episode', { url: currentAnimeData.url }); break;
            case 'logout': auth.signOut(); break;
            case 'subscribe': DB.toggleSubscription({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: currentAnimeData.url }); break;
            case 'delete-comment':
                 const watchView = document.getElementById('watch-view');
                 if(watchView) {
                    const currentEpisodeUrl = currentAnimeData.episodes.find(ep => document.querySelector(`[data-url="${ep.url}"]`)).url;
                    DB.deleteComment(currentAnimeData.url, currentEpisodeUrl, key);
                 }
                break;
        }
    });

    mainContent.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.dataset.action === 'submit-comment') {
            const input = e.target.querySelector('input');
            const episodeUrl = currentAnimeData.episodes.find(ep => document.querySelector(`[data-url="${ep.url}"]`)).url;
            DB.submitComment(currentAnimeData.url, episodeUrl, input.value);
            input.value = '';
            e.target.querySelector('button').disabled = true;
        }
    });

    mainContent.addEventListener('input', e => {
        if (e.target.id === 'comment-input') {
            document.getElementById('comment-submit-btn').disabled = e.target.value.trim() === '';
        }
    });
});
// === BAGIAN 2 DARI 2 SELESAI ---
