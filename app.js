// ==========================================================
// BAGIAN 1: INISIALISASI & SETUP
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// GANTI DENGAN KONFIGURASI FIREBASE ANDA SENDIRI
const firebaseConfig = {
    apiKey: "ISI_DENGAN_API_KEY_ANDA",
    authDomain: "ISI_DENGAN_AUTH_DOMAIN_ANDA",
    projectId: "ISI_DENGAN_PROJECT_ID_ANDA",
    storageBucket: "ISI_DENGAN_STORAGE_BUCKET_ANDA",
    messagingSenderId: "ISI_DENGAN_MESSAGING_SENDER_ID_ANDA",
    appId: "ISI_DENGAN_APP_ID_ANDA"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ==========================================================
// BAGIAN 2: SELEKTOR DOM & STATE APLIKASI
// ==========================================================
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('loginBtn');
const appContainer = document.getElementById('app-container');
const appElement = document.getElementById('app');
const bottomNavElement = document.querySelector('.bottom-nav');

let currentUser = null; // Variabel untuk menyimpan data pengguna

// ==========================================================
// BAGIAN 3: MANAJEMEN DATA LOCALSTORAGE (DENGAN PENAMBAHAN)
// ==========================================================
const LocalDataManager = {
    getSubscriptions: () => JSON.parse(localStorage.getItem('bubuwi_subscriptions')) || [],
    addSubscription: (anime) => {
        const subs = LocalDataManager.getSubscriptions();
        if (!subs.some(s => s.link === anime.link)) {
            subs.push(anime);
            localStorage.setItem('bubuwi_subscriptions', JSON.stringify(subs));
            alert(`"${anime.title}" telah ditambahkan ke langganan!`);
        } else {
            alert(`"${anime.title}" sudah ada di daftar langganan.`);
        }
    },
    // FUNGSI BARU untuk mengecek apakah sebuah anime sudah di-subscribe
    isSubscribed: (animeLink) => {
        const subs = LocalDataManager.getSubscriptions();
        return subs.some(s => s.link === animeLink);
    },
    getHistory: () => JSON.parse(localStorage.getItem('bubuwi_history')) || [],
    addHistory: (anime) => {
        let history = LocalDataManager.getHistory();
        history = history.filter(h => h.link !== anime.link);
        history.unshift(anime);
        if (history.length > 20) history.pop();
        localStorage.setItem('bubuwi_history', JSON.stringify(history));
    }
};
// ==========================================================
// BAGIAN 4: AUTENTIKASI PENGGUNA
// ==========================================================

// Fungsi ini adalah pusat kendali aplikasi.
// Ia akan berjalan otomatis saat halaman dimuat dan setiap kali status login berubah.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- KONDISI SAAT PENGGUNA BERHASIL LOGIN ---
        currentUser = user;

        // Simpan atau perbarui info pengguna di Firebase Database
        const userRef = ref(db, 'users/' + user.uid);
        set(userRef, {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString()
        });
        
        // Tampilkan aplikasi utama dan sembunyikan layar login
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');

        // Jalankan router untuk menampilkan halaman yang benar
        router();

    } else {
        // --- KONDISI SAAT PENGGUNA LOGOUT ATAU BELUM LOGIN ---
        currentUser = null;

        // Tampilkan layar login dan sembunyikan aplikasi utama
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Event listener untuk tombol login Google
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Login Gagal:", error));
});

// Fungsi untuk menangani logout
function handleLogout() {
    if (confirm("Anda yakin ingin logout?")) {
        signOut(auth).catch(error => console.error("Logout Gagal:", error));
    }
}
// Membuat fungsi logout bisa diakses secara global (untuk tombol di HTML)
window.handleLogout = handleLogout;


// ==========================================================
// BAGIAN 5: ROUTER & EVENT LISTENER UTAMA
// ==========================================================

// Fungsi Router utama yang mengontrol halaman mana yang ditampilkan
const router = async () => {
    // Kosongkan konten sebelum menggambar yang baru
    appElement.innerHTML = '';
    
    // Ambil path dan parameter dari URL hash
    const [path, queryString] = window.location.hash.split('?');
    const page = path.substring(2) || 'utama';
    const params = new URLSearchParams(queryString);

    // Render navigasi bawah dan tandai yang aktif
    renderNav(page);

    // Tampilkan halaman yang sesuai
    switch(page) {
        case 'utama':
            await renderHalamanUtama();
            break;
        case 'subscribe':
            renderHalamanSubscribe();
            break;
        case 'akun':
            renderHalamanAkun();
            break;
        case 'detail':
            const link = params.get('link');
            const title = params.get('title');
            const poster = params.get('poster');
            await renderDetailPage(link, title, poster);
            break;
        case 'watch':
            const episodeLink = params.get('episodeLink');
            const seriesLink = params.get('seriesLink');
            const seriesTitle = params.get('seriesTitle');
            await renderWatchPage(episodeLink, seriesLink, seriesTitle);
            break;
        default:
            await renderHalamanUtama();
            break;
    }
};

// Jalankan router saat halaman pertama kali dimuat atau hash berubah
window.addEventListener('hashchange', router);
// ==========================================================
// BAGIAN 6: FUNGSI-FUNGSI PEMBANTU RENDER
// ==========================================================

/**
 * Fungsi untuk menggambar ulang navigasi bawah dan menandai halaman aktif.
 */
const renderNav = (page) => {
    // Tentukan nav mana yang harus aktif. Jika di halaman detail/nonton, anggap 'utama' yang aktif.
    const mainPages = ['utama', 'subscribe', 'akun'];
    const activeNav = mainPages.includes(page) ? page : 'utama';

    bottomNavElement.innerHTML = `
        <a href="#/" class="nav-link ${activeNav === 'utama' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>Utama</span>
        </a>
        <a href="#/subscribe" class="nav-link ${activeNav === 'subscribe' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            <span>Subscribe</span>
        </a>
        <a href="#/akun" class="nav-link ${activeNav === 'akun' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>Akun</span>
        </a>
    `;
};

/**
 * Fungsi untuk membuat elemen <a> kartu episode.
 * Perhatikan bagaimana kita menyertakan seriesLink dan seriesTitle untuk fitur Prev/Next nanti.
 */
function createEpisodeCard(episode, seriesLink, seriesTitle) {
    const card = document.createElement('a');
    card.className = 'episode-card';
    card.href = `#/watch?episodeLink=${encodeURIComponent(episode.link)}&seriesLink=${encodeURIComponent(seriesLink)}&seriesTitle=${encodeURIComponent(seriesTitle)}`;
    card.textContent = episode.title;
    return card;
}

/**
 * Fungsi untuk membuat elemen <a> kartu hasil pencarian.
 */
function createSearchResultCard(anime) {
    const card = document.createElement('a');
    card.className = 'search-result-card';
    card.href = `#/detail?link=${encodeURIComponent(anime.link)}&title=${encodeURIComponent(anime.title)}&poster=${encodeURIComponent(anime.thumbnail)}`;
    card.textContent = anime.title;
    return card;
}

/**
 * Fungsi untuk membuat elemen <a> kartu anime dari template.
 */
function createAnimeCard(anime) {
    const template = document.getElementById('anime-card-template');
    const card = template.content.cloneNode(true).firstElementChild;
    card.href = `#/detail?link=${encodeURIComponent(anime.link)}&title=${encodeURIComponent(anime.title || anime.seriesTitle)}&poster=${encodeURIComponent(anime.poster || anime.thumbnail)}`;
    card.querySelector('.anime-poster').src = anime.poster || anime.thumbnail || 'https://placehold.co/400x600/1e1e1e/white?text=No+Image';
    card.querySelector('.anime-title').textContent = anime.title || anime.seriesTitle;
    const episodeElement = card.querySelector('.anime-episode');
    if (anime.episode) {
        episodeElement.textContent = `Eps: ${anime.episode}`;
    } else {
        episodeElement.remove();
    }
    return card;
}


// ==========================================================
// BAGIAN 7: EVENT LISTENER KLIK UTAMA (EVENT DELEGATION)
// ==========================================================

// Satu event listener ini menangani semua klik pada kartu anime, episode, dll.
appElement.addEventListener('click', (e) => {
    // Cari elemen <a> terdekat dari target yang diklik
    const targetLink = e.target.closest('a');

    // Jika yang diklik atau induknya bukan tag <a>, abaikan
    if (!targetLink || !targetLink.href.includes('#')) return;
    
    // Hentikan perilaku default link agar halaman tidak refresh
    e.preventDefault(); 
    
    // Ambil URL hash dari atribut href kartu yang diklik
    const targetHash = new URL(targetLink.href).hash;

    // Jika hash-nya ada, ubah URL hash di browser.
    // Ini akan secara otomatis memicu 'hashchange' yang akan menjalankan router.
    if (targetHash) {
        window.location.hash = targetHash;
    }
});
// ==========================================================
// BAGIAN 8: FUNGSI-FUNGSI RENDER HALAMAN UTAMA
// ==========================================================

/**
 * Fungsi untuk merender seluruh konten Halaman Utama.
 */
async function renderHalamanUtama() {
    // 1. Tampilkan loader dulu
    appElement.innerHTML = `<div class="loading-screen"><div class="loader"></div><p>Memuat Data...</p></div>`;

    // 2. Siapkan semua bagian HTML sebagai string
    const heroHTML = `
        <div class="card hero-card floating-card">
            <img src="https://files.catbox.moe/03g5k9.gif" class="hero-bg" alt="Hero Background">
            <div class="hero-content">
                <div class="hero-logo img-frame">
                    <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi">
                </div>
                <h2 class="hero-title">Bubuwi-V3</h2>
            </div>
        </div>`;

    const searchHTML = `
        <div class="card search-card">
            <form id="search-form">
                <input type="search" id="search-input" placeholder="Cari judul anime...">
                <button type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </form>
        </div>`;

    // 3. Siapkan bagian Riwayat dari localStorage
    const history = LocalDataManager.getHistory();
    let historyHTML = `<h3 class="section-title">Terakhir Ditonton</h3>`;
    if (history.length > 0) {
        historyHTML += `<div class="anime-grid small-grid">`;
        history.forEach(anime => {
            historyHTML += createAnimeCard(anime).outerHTML;
        });
        historyHTML += `</div>`;
    } else {
        historyHTML += `<p class="empty-state">Belum ada riwayat tontonan.</p>`;
    }

    // 4. Ambil data Rilisan Baru dari API
    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    try {
        const response = await fetch('/.netlify/functions/scrape');
        if (!response.ok) throw new Error('Gagal mengambil data rilis baru.');
        const newReleases = await response.json();
        
        let animeCardsHTML = '';
        if(newReleases.results && newReleases.results.length > 0){
             newReleases.results.forEach(anime => {
                animeCardsHTML += createAnimeCard(anime).outerHTML;
            });
            newReleaseHTML += `<div class="anime-grid small-grid">${animeCardsHTML}</div>`;
        } else {
            throw new Error('API tidak mengembalikan hasil rilis baru.');
        }
    } catch (error) {
        console.error("Error fetching new releases:", error);
        newReleaseHTML += `<p class="empty-state">Gagal memuat data rilis baru.</p>`;
    }
    
    // 5. Gabungkan semua HTML dan render ke DOM
    appElement.innerHTML = `
        ${heroHTML}
        ${searchHTML}
        <div class="card">${historyHTML}</div>
        <div class="card" id="search-results-section">${newReleaseHTML}</div>
    `;

    // 6. Tambahkan event listener untuk form pencarian
    document.getElementById('search-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        const resultsSection = document.getElementById('search-results-section');
        resultsSection.innerHTML = `<div class="loader"></div><p style="text-align:center;">Mencari "${query}"...</p>`;
        try {
            const response = await fetch(`/.netlify/functions/scrape?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Gagal melakukan pencarian.');
            const searchResults = await response.json();
            
            let searchResultHTML = `<h3 class="section-title">Hasil Pencarian</h3>`;
            if (searchResults.results && searchResults.results.length > 0) {
                 searchResults.results.forEach(anime => {
                     searchResultHTML += createSearchResultCard(anime).outerHTML;
                 });
            } else {
                 searchResultHTML += `<p class="empty-state">Tidak ada hasil ditemukan untuk "${query}".</p>`;
            }
            resultsSection.innerHTML = searchResultHTML;
        } catch (error) {
            console.error("Error searching anime:", error);
            resultsSection.innerHTML = `<p class="empty-state">Terjadi kesalahan saat mencari.</p>`;
        }
    });
}

/**
 * Fungsi untuk merender halaman Subscribe.
 */
function renderHalamanSubscribe() {
    const subscriptions = LocalDataManager.getSubscriptions();
    let contentHTML = `<h1 class="section-title">Langganan Saya</h1>`;

    if (subscriptions.length > 0) {
        contentHTML += `<div class="anime-grid">`;
        subscriptions.forEach(anime => {
            const card = createAnimeCard(anime);
            card.style.animationDelay = `${Math.random() * 0.5}s`;
            contentHTML += card.outerHTML;
        });
        contentHTML += `</div>`;
    } else {
        contentHTML += `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <h2 class="empty-state-title">Daftar Langganan Kosong</h2>
                <p>Anda belum berlangganan anime apapun.</p>
            </div>
        `;
    }
    appElement.innerHTML = contentHTML;
}

/**
 * Fungsi untuk merender halaman Akun.
 */
function renderHalamanAkun() {
    if (!currentUser) return;
    appElement.innerHTML = `
        <div class="card user-card floating-card">
            <div class="profile-pic img-frame"><img src="${currentUser.photoURL}" alt="Profil"></div>
            <div class="user-info"><div class="username">${currentUser.displayName}</div><div class="email">${currentUser.email}</div></div>
        </div>
        <h3 class="section-title">Kontak Developer</h3>
        <a href="https://instagram.com/adnanmwa" target="_blank" class="card contact-card floating-card" style="animation-delay: 0.1s;">
            <div class="contact-logo-wrapper img-frame"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/500px-Instagram_icon.png" alt="IG"></div>
            <span class="contact-username">@adnanmwa</span>
        </a>
        <a href="https://tiktok.com/@adnansagiri" target="_blank" class="card contact-card floating-card" style="animation-delay: 0.2s;">
            <div class="contact-logo-wrapper img-frame"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok"></div>
            <span class="contact-username">@adnansagiri</span>
        </a>
        <button id="logoutBtn-main" onclick="window.handleLogout()">Logout</button>
    `;
}
// ==========================================================
// BAGIAN 9: FUNGSI-FUNGSI RENDER HALAMAN DETAIL & NONTON
// ==========================================================

/**
 * Fungsi untuk merender halaman detail yang berisi daftar episode.
 */
async function renderDetailPage(link, title, poster) {
    appElement.innerHTML = `<div class="loading-screen"><div class="loader"></div><p>Memuat Episode...</p></div>`;
    
    try {
        const response = await fetch(`/.netlify/functions/scrape?animePage=${encodeURIComponent(link)}`);
        if (!response.ok) throw new Error('Gagal memuat detail anime.');
        
        const data = await response.json();

        const finalPoster = poster && poster !== 'undefined' ? poster : (data.thumbnail || 'https://placehold.co/400x600/1e1e1e/white?text=No+Image');

        // Cek apakah anime ini sudah di-subscribe
        const isSubscribed = LocalDataManager.isSubscribed(link);

        let detailHTML = `
            <div class="detail-header">
                <div class="img-frame">
                    <img src="${finalPoster}" alt="${title}" class="detail-poster">
                </div>
                <div class="detail-info">
                    <h1 class="detail-title">${title}</h1>
                    <p class="episode-count">Total Episode: ${data.episodeCount || '?'}</p>
                    <button id="subscribeBtn" class="subscribe-button ${isSubscribed ? 'subscribed' : ''}">
                        ${isSubscribed ? 'Tersubscribe' : '⭐ Subscribe'}
                    </button>
                </div>
            </div>
            <h2 class="section-title">Daftar Episode</h2>
            <div class="episode-list">
        `;

        if (data.episodes && data.episodes.length > 0) {
            data.episodes.forEach(ep => {
                detailHTML += createEpisodeCard(ep, link, title).outerHTML; // Kirim link seri dan judul seri
            });
        } else {
            detailHTML += `<p class="empty-state">Daftar episode tidak ditemukan.</p>`;
        }

        detailHTML += `</div>`;
        appElement.innerHTML = detailHTML;

        document.getElementById('subscribeBtn').addEventListener('click', (e) => {
            LocalDataManager.addSubscription({ title, poster: finalPoster, link });
            // Ubah tampilan tombol setelah diklik
            e.target.classList.add('subscribed');
            e.target.textContent = '✓ Tersubscribe';
        });

    } catch (error) {
        console.error("Error rendering detail page:", error);
        appElement.innerHTML = `<p class="empty-state">Terjadi kesalahan saat memuat halaman detail.</p>`;
    }
}


/**
 * Fungsi untuk merender halaman untuk menonton video. (Sudah dirombak total)
 */
async function renderWatchPage(episodeLink, seriesLink, seriesTitle) {
    appElement.innerHTML = `<div class="loading-screen"><div class="loader"></div><p>Memuat Video & Episode Lainnya...</p></div>`;

    try {
        // Ambil data video dan data daftar episode secara bersamaan untuk efisiensi
        const [videoResponse, seriesResponse] = await Promise.all([
            fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(episodeLink)}`),
            fetch(`/.netlify/functions/scrape?animePage=${encodeURIComponent(seriesLink)}`)
        ]);

        if (!videoResponse.ok || !seriesResponse.ok) throw new Error('Gagal memuat data video atau daftar episode.');

        const videoData = await videoResponse.json();
        const seriesData = await seriesResponse.json();
        const allEpisodes = seriesData.episodes || [];

        // Cari tahu episode saat ini dan episode sebelum/sesudahnya
        const currentIndex = allEpisodes.findIndex(ep => ep.link === episodeLink);
        const prevEpisode = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null;
        const nextEpisode = currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

        let watchHTML = `
            <div class="watch-page">
                <div class="watch-header">
                    <p class="watch-anime-title">${seriesTitle}</p>
                    <h1 class="watch-episode-title">${videoData.title}</h1>
                </div>
        `;

        if (videoData.videoFrames && videoData.videoFrames.length > 0) {
            watchHTML += `<div class="video-container"><iframe src="${videoData.videoFrames[0]}" frameborder="0" allow="encrypted-media" allowfullscreen></iframe></div>`;
        } else {
            watchHTML += `<p class="empty-state">Link video tidak ditemukan.</p>`;
        }
        
        // Buat tombol Navigasi Prev & Next
        watchHTML += `<div class="watch-nav">`;
        if (prevEpisode) {
            watchHTML += `<a href="#/watch?episodeLink=${encodeURIComponent(prevEpisode.link)}&seriesLink=${encodeURIComponent(seriesLink)}&seriesTitle=${encodeURIComponent(seriesTitle)}" class="watch-nav-button">❮ Prev</a>`;
        } else {
            watchHTML += `<button class="watch-nav-button" disabled>❮ Prev</button>`;
        }
        if (nextEpisode) {
            watchHTML += `<a href="#/watch?episodeLink=${encodeURIComponent(nextEpisode.link)}&seriesLink=${encodeURIComponent(seriesLink)}&seriesTitle=${encodeURIComponent(seriesTitle)}" class="watch-nav-button">Next ❯</a>`;
        } else {
            watchHTML += `<button class="watch-nav-button" disabled>Next ❯</button>`;
        }
        watchHTML += `</div>`;

        // Buat daftar semua episode
        if (allEpisodes.length > 0) {
            watchHTML += `<h3 class="section-title">Semua Episode</h3><div class="episode-grid-watch">`;
            allEpisodes.forEach((ep, index) => {
                const isActive = index === currentIndex ? 'active' : '';
                watchHTML += `
                    <a href="#/watch?episodeLink=${encodeURIComponent(ep.link)}&seriesLink=${encodeURIComponent(seriesLink)}&seriesTitle=${encodeURIComponent(seriesTitle)}" 
                       class="episode-grid-button ${isActive}">
                       ${ep.title.split(' ').pop()} 
                    </a>`;
            });
            watchHTML += `</div>`;
        }

        watchHTML += `</div>`;
        appElement.innerHTML = watchHTML;
        
        // Simpan ke riwayat
        LocalDataManager.addHistory({
            title: seriesTitle,
            poster: seriesData.thumbnail, // Ambil poster dari data seri
            link: seriesLink,
            episode: videoData.title.split(' ').pop()
        });

    } catch(error) {
        console.error("Error rendering watch page:", error);
        appElement.innerHTML = `<p class="empty-state">Terjadi kesalahan saat memuat video.</p>`;
    }
}
