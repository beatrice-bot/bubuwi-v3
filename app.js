// ==========================================================
// BAGIAN 1: INISIALISASI & IMPORT
// ==========================================================
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const auth = getAuth();
const db = getDatabase();

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
    // card.dataset.animeLink = anime.link; // Simpan link untuk navigasi detail
    return card;
}

// 6.1. Render Halaman UTAMA
async function renderHalamanUtama() { // Tambahkan async
    const heroHTML = `...`; // (Sama seperti sebelumnya)
    const searchHTML = `...`; // (Sama seperti sebelumnya)
    const history = LocalDataManager.getHistory();
    let historyHTML = `...`; // (Sama seperti sebelumnya)

    // --- PERBAIKAN 1: PANGGIL API SCRAPING UNTUK RILISAN BARU ---
    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    try {
        appElement.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Memuat Data...</p></div>`; // Tampilkan loader
        
        const response = await fetch('/.netlify/functions/scrape'); // Tidak perlu endpoint karena defaultnya home
        if (!response.ok) throw new Error('Gagal mengambil data dari server.');
        
        const newReleases = await response.json();

        let animeCardsHTML = '';
        newReleases.results.forEach(anime => {
            const card = createAnimeCard({
                poster: anime.thumbnail,
                title: anime.seriesTitle,
                link: anime.link // Menyimpan link untuk masa depan
            });
            card.classList.add('floating-card');
            animeCardsHTML += card.outerHTML;
        });
        newReleaseHTML += `<div class="anime-grid">${animeCardsHTML}</div>`;

    } catch (error) {
        console.error("Error fetching new releases:", error);
        newReleaseHTML += `<p class="empty-state">Gagal memuat data rilis baru. Coba lagi nanti.</p>`;
    }

    // Gabungkan semua bagian dan masukkan ke halaman
    appElement.innerHTML = `
        ${heroHTML}
        ${searchHTML}
        <div class="card" id="history-section">${historyHTML}</div>
        <div class="card" id="new-release-section">${newReleaseHTML}</div>
    `;

    // --- PERBAIKAN 2: FUNGSIKAN FORM PENCARIAN ---
    const searchForm = document.getElementById('search-form');
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        // Tampilkan loader di bagian rilis baru
        const newReleaseSection = document.getElementById('new-release-section');
        newReleaseSection.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Mencari "${query}"...</p></div>`;

        try {
            const response = await fetch(`/.netlify/functions/scrape?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Gagal melakukan pencarian.');

            const searchResults = await response.json();
            
            let searchResultHTML = `<h3 class="section-title">Hasil Pencarian: ${query}</h3>`;
            if (searchResults.results && searchResults.results.length > 0) {
                 let animeCardsHTML = '';
                 searchResults.results.forEach(anime => {
                     const card = createAnimeCard({
                         poster: anime.thumbnail, // thumbnail mungkin null dari search
                         title: anime.title,
                         link: anime.link
                     });
                     card.classList.add('floating-card');
                     animeCardsHTML += card.outerHTML;
                 });
                 searchResultHTML += `<div class="anime-grid">${animeCardsHTML}</div>`;
            } else {
                 searchResultHTML += `<p class="empty-state">Tidak ada hasil ditemukan untuk "${query}".</p>`;
            }
            // Ganti konten rilis baru dengan hasil pencarian
            newReleaseSection.innerHTML = searchResultHTML;

        } catch (error) {
            console.error("Error searching anime:", error);
            newReleaseSection.innerHTML = `<p class="empty-state">Terjadi kesalahan saat mencari. Coba lagi.</p>`;
        }
    });
}


// 6.2. Render Halaman SUBSCRIBE
function renderHalamanSubscribe() {
    // ... (Kode ini sudah benar, tidak perlu diubah) ...
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
                <p>Anda belum berlangganan anime apapun. Tekan tombol 'Subscribe' di halaman detail anime untuk menambahkannya di sini.</p>
            </div>
        `;
    }
    appElement.innerHTML = contentHTML;
}

// 6.3. Render Halaman AKUN
function renderHalamanAkun() {
    // ... (Kode ini juga sudah benar, tidak perlu diubah) ...
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

// Tambahkan beberapa gaya untuk loader
const style = document.createElement('style');
style.textContent = `
.loading-container { text-align: center; padding: 40px 20px; color: var(--text-secondary); }
.loader {
    border: 4px solid #f3f3f3;
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px auto;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);
