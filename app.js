// ==========================================================
// BAGIAN 1: INISIALISASI & IMPORT
// ==========================================================
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
// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ==========================================================
// BAGIAN 2: SELEKTOR DOM (Mengambil elemen HTML)
// ==========================================================
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('loginBtn');
const appContainer = document.getElementById('app-container');
const appElement = document.getElementById('app');
const navLinks = document.querySelectorAll('.nav-link');

// ==========================================================
// BAGIAN 3: MANAJEMEN DATA (LocalStorage)
// ==========================================================
const LocalDataManager = {
    getSubscriptions: () => JSON.parse(localStorage.getItem('bubuwi_subscriptions')) || [],
    addSubscription: (anime) => {
        const subs = LocalDataManager.getSubscriptions();
        if (!subs.some(s => s.title === anime.title)) {
            subs.push(anime);
            localStorage.setItem('bubuwi_subscriptions', JSON.stringify(subs));
        }
    },
    getHistory: () => JSON.parse(localStorage.getItem('bubuwi_history')) || [],
    addHistory: (anime) => {
        let history = LocalDataManager.getHistory();
        history = history.filter(h => h.title !== anime.title);
        history.unshift(anime);
        if (history.length > 20) {
            history.pop();
        }
        localStorage.setItem('bubuwi_history', JSON.stringify(history));
    }
};
// ==========================================================
// BAGIAN 4: AUTENTIKASI FIREBASE
// ==========================================================
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const userRef = ref(db, 'users/' + user.uid);
        set(userRef, {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString()
        });

        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        navigateTo(window.location.hash || '#/');

    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Login Gagal:", error));
});

function handleLogout() {
    if (confirm("Anda yakin ingin logout?")) {
        signOut(auth).catch(error => console.error("Logout Gagal:", error));
    }
}
window.handleLogout = handleLogout;

// ==========================================================
// BAGIAN 5: ROUTER SEDERHANA (Navigasi Halaman)
// ==========================================================
function navigateTo(hash) {
    const page = hash.substring(2) || 'utama';

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    // Scroll ke atas setiap pindah halaman
    window.scrollTo(0, 0);

    // Hapus event listener lama sebelum merender halaman baru untuk mencegah kebocoran memori
    appElement.innerHTML = '';

    switch(page) {
        case 'utama':
            renderHalamanUtama();
            break;
        case 'subscribe':
            renderHalamanSubscribe();
            break;
        case 'akun':
            renderHalamanAkun();
            break;
        default:
            renderHalamanUtama();
            break;
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
    });
});

window.addEventListener('hashchange', () => navigateTo(window.location.hash));
// ==========================================================
// BAGIAN 6: FUNGSI RENDER (Menggambar setiap Halaman)
// ==========================================================
function createAnimeCard(anime) {
    const template = document.getElementById('anime-card-template');
    const card = template.content.cloneNode(true).firstElementChild;
    card.querySelector('.anime-poster').src = anime.poster || 'https://placehold.co/400x600/1e1e1e/white?text=No+Image';
    card.querySelector('.anime-poster').alt = anime.title;
    card.querySelector('.anime-title').textContent = anime.title;
    const episodeElement = card.querySelector('.anime-episode');
    if (anime.episode) {
        episodeElement.textContent = `Terakhir ditonton: ${anime.episode}`;
    } else {
        episodeElement.remove();
    }
    // PERBAIKAN: Tambahkan event listener untuk menangani klik
    card.addEventListener('click', () => {
        alert(`Anda mengklik: ${anime.title}\nLink: ${anime.link || 'Tidak ada'}`);
        // Di sini nantinya akan ada logika untuk pindah ke halaman detail anime
        // Contoh: LocalDataManager.addHistory(anime);
    });
    return card;
}

// 6.1. Render Halaman UTAMA
async function renderHalamanUtama() {
    // Tampilkan loader dulu
    appElement.innerHTML = `<div class="loading-screen"><div class="loader"></div><p>Memuat Data...</p></div>`;

    // PERBAIKAN: Definisikan semua string HTML dengan benar
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
        <div class="card search-card" style="animation-delay: 0.1s;">
            <form id="search-form">
                <input type="search" id="search-input" placeholder="Cari judul anime...">
                <button type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </form>
        </div>`;

    const history = LocalDataManager.getHistory();
    let historyHTML = `<h3 class="section-title">Terakhir Ditonton</h3>`;
    if (history.length > 0) {
        historyHTML += `<div class="anime-grid new-releases-grid">`; // Gunakan grid kecil
        history.forEach(anime => {
            historyHTML += createAnimeCard(anime).outerHTML;
        });
        historyHTML += `</div>`;
    } else {
        historyHTML += `<p class="empty-state">Belum ada riwayat tontonan.</p>`;
    }

    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    try {
        const response = await fetch('/.netlify/functions/scrape');
        if (!response.ok) throw new Error('Gagal mengambil data rilis baru.');
        const newReleases = await response.json();
        
        let animeCardsHTML = '';
        if(newReleases.results && newReleases.results.length > 0){
             newReleases.results.forEach(anime => {
                animeCardsHTML += createAnimeCard({
                    poster: anime.thumbnail,
                    title: anime.seriesTitle,
                    link: anime.link
                }).outerHTML;
            });
            newReleaseHTML += `<div class="anime-grid new-releases-grid">${animeCardsHTML}</div>`;
        } else {
            throw new Error('Tidak ada data rilis baru.');
        }

    } catch (error) {
        console.error("Error fetching new releases:", error);
        newReleaseHTML += `<p class="empty-state">Gagal memuat data rilis baru.</p>`;
    }
    
    // PERBAIKAN: Gabungkan semua HTML lalu render ke DOM sekaligus
    appElement.innerHTML = `
        ${heroHTML}
        ${searchHTML}
        <div class="card" id="history-section">${historyHTML}</div>
        <div class="card" id="search-results-section">${newReleaseHTML}</div>
    `;

    // PERBAIKAN: Tambahkan event listener SETELAH elemennya ada di DOM
    const searchForm = document.getElementById('search-form');
    searchForm.addEventListener('submit', async (e) => {
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
                 let animeCardsHTML = '';
                 searchResults.results.forEach(anime => {
                     animeCardsHTML += createAnimeCard({
                         poster: anime.thumbnail,
                         title: anime.title,
                         link: anime.link
                     }).outerHTML;
                 });
                 searchResultHTML += `<div class="anime-grid">${animeCardsHTML}</div>`;
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
// 6.2. Render Halaman SUBSCRIBE
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

// 6.3. Render Halaman AKUN
function renderHalamanAkun() {
    if (!currentUser) return;

    const userCardHTML = `
        <div class="card user-card floating-card">
            <div class="profile-pic img-frame">
                <img src="${currentUser.photoURL}" alt="Foto Profil">
            </div>
            <div class="user-info">
                <div class="username">${currentUser.displayName}</div>
                <div class="email">${currentUser.email}</div>
            </div>
        </div>
    `;

    const devContactHTML = `
        <h3 class="section-title">Kontak Developer</h3>
        <a href="https://instagram.com/adnanmwa" target="_blank" class="card contact-card floating-card" style="animation-delay: 0.1s;">
            <div class="contact-logo-wrapper img-frame">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/500px-Instagram_icon.png" alt="Instagram">
            </div>
            <span class="contact-username">@adnanmwa</span>
        </a>
        <a href="https://tiktok.com/@adnansagiri" target="_blank" class="card contact-card floating-card" style="animation-delay: 0.2s;">
            <div class="contact-logo-wrapper img-frame">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok">
            </div>
            <span class="contact-username">@adnansagiri</span>
        </a>
    `;

    const logoutButtonHTML = `<button id="logoutBtn-main" onclick="window.handleLogout()">Logout</button>`;
    
    appElement.innerHTML = `
        ${userCardHTML}
        ${devContactHTML}
        ${logoutButtonHTML}
    `;
}
