// === BAGIAN 1 DARI 3 DIMULAI ===

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. KONFIGURASI & INISIALISASI ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
        authDomain: "bubuwi-pro.firebaseapp.com",
        projectId: "bubuwi-pro",
        databaseURL: "https://bubuwi-pro-default-rtdb.asia-southeast1.firebasedatabase.app",
        storageBucket: "bubuwi-pro.appspot.com",
        messagingSenderId: "741891119074",
        appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- KODE PERBAIKAN BUG TOMBOL LOGIN ---
    document.getElementById('login-btn').addEventListener('click', () => auth.signInWithPopup(provider).catch(console.error));


    // --- 2. STATE APLIKASI ---
    let currentUser = null;
    let activeListeners = [];
    let currentAnimeData = {};

    // --- 3. ELEMEN UTAMA ---
    const mainContent = document.getElementById('main-content');
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // --- 4. FUNGSI UTILITAS ---
    const showLoading = (isLoading) => { loadingOverlay.style.display = isLoading ? 'flex' : 'none'; };
    const generateKey = (str) => str ? str.replace(/[.#$[\]]/g, '_') : Date.now().toString();
    const profanityList = ['anjing', 'anj', 'ajg', 'babi', 'ngentot', 'ngewe', 'ewe', 'kontol', 'kntl', 'memek', 'mmk'];
    const profanityRegex = new RegExp(profanityList.join('|'), 'i');

    // --- 5. MODUL API (MENGAMBIL DATA DARI SCRAPER) ---
    const API = (() => {
        const CACHE_DURATION = 15 * 60 * 1000;
        
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

// === BAGIAN 1 DARI 3 SELESAI ===
                          // === BAGIAN 2 DARI 3 DIMULAI ===

    // --- 6. MODUL DATABASE (INTERAKSI DENGAN FIREBASE) ---
    const DB = (() => {
        const listen = (ref, callback) => {
            ref.on('value', callback);
            activeListeners.push({ ref, callback });
        };

        return {
            addToHistory: (animeData) => {
                if (!currentUser) return;
                const ref = db.ref(`users/${currentUser.uid}/history/${generateKey(animeData.url)}`);
                ref.set({
                    title: animeData.title,
                    poster: animeData.poster,
                    url: animeData.url,
                    lastWatched: firebase.database.ServerValue.TIMESTAMP
                });
            },
            toggleSubscription: (animeData) => {
                if (!currentUser) return;
                const ref = db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(animeData.url)}`);
                ref.once('value', snapshot => {
                    if (snapshot.exists()) {
                        ref.remove();
                    } else {
                        ref.set(animeData);
                    }
                });
            },
            submitComment: (animeUrl, episodeUrl, text) => {
                if (!currentUser || !text) return;
                if (profanityRegex.test(text)) {
                    alert("Komentar anda mengandung kata yang tidak sopan!");
                    return;
                }
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`);
                ref.push({
                    uid: currentUser.uid,
                    name: currentUser.displayName,
                    pfp: currentUser.photoURL,
                    text: text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            },
            deleteComment: (animeUrl, episodeUrl, commentKey) => {
                if (!currentUser) return;
                const ref = db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}/${commentKey}`);
                ref.once('value', snapshot => {
                    if (snapshot.exists() && snapshot.val().uid === currentUser.uid) {
                        ref.remove();
                    }
                });
            },
            listenToHistory: (callback) => listen(db.ref(`users/${currentUser.uid}/history`), callback),
            listenToSubscriptions: (callback) => listen(db.ref(`users/${currentUser.uid}/subscriptions`), callback),
            listenToComments: (animeUrl, episodeUrl, callback) => listen(db.ref(`comments/${generateKey(animeUrl)}/${generateKey(episodeUrl)}`).orderByChild('timestamp'), callback),
            listenToSingleSubscription: (animeUrl, callback) => listen(db.ref(`users/${currentUser.uid}/subscriptions/${generateKey(animeUrl)}`), callback),
        };
    })();

    // --- 7. MODUL UI (TEMPLATE HTML & RENDER) ---
    const UI = (() => {
        const createAnimeCard = (anime) => `
            <div class="anime-card" data-url="${anime.url}">
                <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
                <div class="title">${anime.episode || anime.title}</div>
            </div>
        `;
        const createPopularItem = (anime) => `
            <div class="popular-item" data-url="${anime.url}">
                <span class="rank">${anime.rank}</span>
                <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
                <div class="info"><div class="title">${anime.title}</div></div>
            </div>
        `;
        const createSkeletonCards = (count = 6) => {
            return Array(count).fill('<div class="anime-card skeleton skeleton-card"></div>').join('');
        };
        const createEmptyState = (message) => `<div class="card empty-state-card">${message}</div>`;

        const templates = {
            home: () => `
                <div class="hero-section">
                    <img src="https://i.imgur.com/vH12J6f.jpg" class="hero-bg" alt="Hero Background">
                    <img src="https://i.imgur.com/9uK2OPw.png" class="hero-logo" alt="Bubuwi Logo">
                    <h2 class="hero-title">Temukan Anime Favoritmu</h2>
                </div>
                <div class="search-section card">
                    <input type="text" id="search-input" placeholder="Cari anime...">
                    <button id="search-button"><i class="fas fa-search"></i></button>
                </div>
                <div class="content-section" id="latest-release-section">
                    <h3><i class="fas fa-fire"></i> Baru Rilis</h3>
                    <div class="anime-grid" id="latest-releases-list">${createSkeletonCards(6)}</div>
                </div>
                <div class="content-section" id="popular-section">
                    <h3><i class="fas fa-star"></i> Populer Minggu Ini</h3>
                    <div class="popular-list" id="popular-list">${createSkeletonCards(3).replace(/anime-card/g,'popular-item')}</div>
                </div>
            `,
            subscribe: () => `
                <div class="view-header card"><h3><i class="fas fa-bookmark"></i> Anime yang Di-subscribe</h3></div>
                <div id="subscribed-list" class="anime-grid">${createSkeletonCards(6)}</div>
            `,
            history: () => `
                <div class="view-header card"><h3><i class="fas fa-history"></i> Riwayat Tontonan</h3></div>
                <div id="history-list" class="anime-grid">${createSkeletonCards(6)}</div>
            `,
            account: () => `
                <div class="account-logo-card card"><img src="https://i.imgur.com/9uK2OPw.png" alt="Bubuwi Logo" class="account-logo"></div>
                <div class="account-info-card card">
                    <img src="${currentUser.photoURL}" alt="User Profile" class="profile-pic">
                    <h2>${currentUser.displayName}</h2>
                    <p>${currentUser.email}</p>
                </div>
                <div class="developer-contact card">
                    <h4>Kontak Developer</h4>
                    <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-item"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLht-agYy8VEU-3bkfGKEr9sqEe--B8jfA7Q&s" alt="Instagram"><span>@adnanmwa</span></a>
                    <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-item"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrLEt7CpnTRQ1va0on-RGO3aDsgpdlNFUoaw&s" alt="TikTok"><span>@adnansagiri</span></a>
                </div>
                <button id="logout-btn" class="logout-button">Logout</button>
            `,
            episode: (data) => `
                <button class="back-button"><i class="fas fa-arrow-left"></i> Kembali</button>
                <div id="anime-detail-header" class="card">
                    <img src="${data.poster}" alt="${data.title}">
                    <div class="info"><h2>${data.title}</h2></div>
                </div>
                <div id="anime-detail-synopsis" class="card synopsis-card">
                    <h4>Sinopsis</h4><p>${data.synopsis || 'Tidak ada sinopsis.'}</p>
                </div>
                <button id="subscribe-button" class="subscribe-button" data-url="${data.url}"><i class="fas fa-plus"></i> Subscribe</button>
                <div class="episode-list-container card">
                    <h4>Pilih Episode</h4>
                    <div id="episode-list" class="episodes-grid">${data.episodes.map(ep => `<div class="episode-item" data-url="${ep.url}">${ep.title.replace(/Subtitle Indonesia|Download/gi, '').trim()}</div>`).join('')}</div>
                </div>
            `,
            watch: (data) => `
                <button class="back-button"><i class="fas fa-arrow-left"></i> Kembali</button>
                <div class="video-player-card card">
                    <div class="video-player-container"><iframe id="video-player" src="${data.videoEmbedUrl || ''}" frameborder="0" allowfullscreen></iframe></div>
                </div>
                <div id="watch-info-box" class="card"><p>${data.episodeTitle}</p></div>
                <div class="episode-navigation">
                    <button id="prev-episode" class="nav-btn" ${!data.prevEpisodeUrl ? 'disabled' : ''} data-url="${data.prevEpisodeUrl}">Prev</button>
                    <button id="next-episode" class="nav-btn" ${!data.nextEpisodeUrl ? 'disabled' : ''} data-url="${data.nextEpisodeUrl}">Next</button>
                </div>
                <div id="add-comment-container" class="card">
                    <h4>Tambahkan Komentar</h4>
                    <div class="add-comment">
                        <img src="${currentUser.photoURL}" alt="User" class="profile-pic-comment">
                        <input type="text" id="comment-input" placeholder="Tulis komentarmu...">
                        <button id="comment-submit-btn" disabled><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div id="comments-list-container" class="card">
                    <h4>Komentar</h4>
                    <div id="comments-list"></div>
                </div>
            `,
        };

// === BAGIAN 2 DARI 3 SELESAI ===
// === BAGIAN 3 DARI 3 DIMULAI ===
        
        return {
            render: (view, data = {}) => {
                mainContent.innerHTML = templates[view](data);
            },
            renderHomepage: (data) => {
                document.getElementById('latest-releases-list').innerHTML = data.latest.map(createAnimeCard).join('');
                document.getElementById('popular-list').innerHTML = data.popularWeekly.map(createPopularItem).join('');
                document.querySelectorAll('#latest-releases-list .anime-card, #popular-list .popular-item').forEach(card => {
                    card.addEventListener('click', () => switchView('episode', { url: card.dataset.url }));
                });
            },
            renderHistory: (snapshot) => {
                const container = document.getElementById('history-list');
                if (!snapshot.exists()) { container.innerHTML = createEmptyState("Riwayat tontonanmu masih kosong."); return; }
                let history = [];
                snapshot.forEach(child => history.push(child.val()));
                container.innerHTML = history.reverse().map(createAnimeCard).join('');
                container.querySelectorAll('.anime-card').forEach(card => {
                    card.addEventListener('click', () => switchView('episode', { url: card.dataset.url }));
                });
            },
            renderSubscriptions: (snapshot) => {
                const container = document.getElementById('subscribed-list');
                if (!snapshot.exists()) { container.innerHTML = createEmptyState("Kamu belum subscribe anime apapun."); return; }
                let subs = [];
                snapshot.forEach(child => subs.push(child.val()));
                container.innerHTML = subs.map(createAnimeCard).join('');
                 container.querySelectorAll('.anime-card').forEach(card => {
                    card.addEventListener('click', () => switchView('episode', { url: card.dataset.url }));
                });
            },
            renderComments: (snapshot, animeUrl, episodeUrl) => {
                const container = document.getElementById('comments-list');
                container.innerHTML = '';
                if (!snapshot.exists()) { container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Belum ada komentar.</p>'; return; }
                let comments = [];
                snapshot.forEach(child => comments.push({ key: child.key, ...child.val() }));
                comments.reverse().forEach(c => {
                    const commentDiv = document.createElement('div');
                    commentDiv.className = 'comment';
                    const escapedText = c.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    commentDiv.innerHTML = `
                        <img src="${c.pfp}" alt="pfp" class="profile-pic-comment">
                        <div class="comment-content">
                            <p class="username">${c.name}</p>
                            <p>${escapedText}</p>
                        </div>
                    `;
                    if (currentUser && currentUser.uid === c.uid) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-comment-btn';
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        deleteBtn.onclick = () => DB.deleteComment(animeUrl, episodeUrl, c.key);
                        commentDiv.appendChild(deleteBtn);
                    }
                    container.appendChild(commentDiv);
                });
            }
        };
    })();


    // --- 8. MANAJEMEN TAMPILAN (VIEW CONTROLLER) ---
    async function switchView(viewName, params = {}) {
        showLoading(true);
        activeListeners.forEach(l => l.ref.off('value', l.callback));
        activeListeners = [];
        
        mainContent.innerHTML = '';
        
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
                    UI.render('account');
                    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
                    break;
                
                case 'episode':
                    const episodeData = await API.getEpisodes(params.url);
                    currentAnimeData = { ...episodeData, url: params.url };
                    UI.render('episode', currentAnimeData);
                    document.querySelector('.back-button').addEventListener('click', () => switchView('home'));
                    document.querySelectorAll('.episode-item').forEach(item => {
                        item.addEventListener('click', () => switchView('watch', { url: item.dataset.url }));
                    });
                    const subBtn = document.getElementById('subscribe-button');
                    subBtn.onclick = () => DB.toggleSubscription({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: currentAnimeData.url });
                    DB.listenToSingleSubscription(params.url, snapshot => {
                        if (snapshot.exists()) {
                            subBtn.innerHTML = '<i class="fas fa-check"></i> Subscribed';
                            subBtn.classList.add('active');
                        } else {
                            subBtn.innerHTML = '<i class="fas fa-plus"></i> Subscribe';
                            subBtn.classList.remove('active');
                        }
                    });
                    break;

                case 'watch':
                    const watchData = await API.getWatch(params.url);
                    const currentEp = currentAnimeData.episodes.find(ep => ep.url === params.url);
                    UI.render('watch', { ...watchData, episodeTitle: currentEp.title.replace(/Subtitle Indonesia|Download/gi, '').trim() });
                    document.querySelector('.back-button').addEventListener('click', () => switchView('episode', { url: currentAnimeData.url }));
                    
                    const prevBtn = document.getElementById('prev-episode');
                    const nextBtn = document.getElementById('next-episode');
                    if (prevBtn.dataset.url) prevBtn.addEventListener('click', () => switchView('watch', { url: prevBtn.dataset.url }));
                    if (nextBtn.dataset.url) nextBtn.addEventListener('click', () => switchView('watch', { url: nextBtn.dataset.url }));
                    
                    const commentInput = document.getElementById('comment-input');
                    const commentSubmitBtn = document.getElementById('comment-submit-btn');
                    commentInput.addEventListener('input', () => commentSubmitBtn.disabled = commentInput.value.trim() === '');
                    commentSubmitBtn.addEventListener('click', () => {
                        DB.submitComment(currentAnimeData.url, params.url, commentInput.value);
                        commentInput.value = '';
                        commentSubmitBtn.disabled = true;
                    });

                    DB.addToHistory({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: currentAnimeData.url });
                    DB.listenToComments(currentAnimeData.url, params.url, (snapshot) => UI.renderComments(snapshot, currentAnimeData.url, params.url));
                    break;
            }
        } catch(error) {
            console.error("Error loading view:", viewName, error);
            mainContent.innerHTML = UI.createEmptyState("Gagal memuat konten. Coba lagi nanti.");
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

    function initGsapAnimations() {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(".hero-bg", {
            scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: true },
            y: 100
        });
        ScrollTrigger.batch(".content-section .anime-card, .content-section .popular-item", {
            start: "top 90%",
            onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" }),
        });
        ScrollTrigger.refresh();
    }
});
// === BAGIAN 3 DARI 3 SELESAI ===
