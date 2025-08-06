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
// Objek ini akan mengelola semua data yang disimpan di perangkat pengguna
const LocalDataManager = {
    getSubscriptions: () => JSON.parse(localStorage.getItem('bubuwi_subscriptions')) || [],
    addSubscription: (anime) => {
        const subs = LocalDataManager.getSubscriptions();
        // Cek agar tidak ada duplikat
        if (!subs.some(s => s.title === anime.title)) {
            subs.push(anime);
            localStorage.setItem('bubuwi_subscriptions', JSON.stringify(subs));
        }
    },
    getHistory: () => JSON.parse(localStorage.getItem('bubuwi_history')) || [],
    addHistory: (anime) => {
        let history = LocalDataManager.getHistory();
        // Hapus entri lama jika judulnya sama, agar hanya ada yang terbaru
        history = history.filter(h => h.title !== anime.title);
        history.unshift(anime); // Tambahkan yang baru di awal array
        // Batasi riwayat, misal 20 item terakhir
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

// Fungsi ini adalah pusat kendali aplikasi.
// Dia akan memeriksa status login setiap kali aplikasi dibuka/di-refresh.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- Pengguna BERHASIL Login ---
        currentUser = user;
        // Simpan/update info pengguna di Firebase Database
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

        // Arahkan ke halaman yang sesuai saat pertama kali load
        navigateTo(window.location.hash || '#/');

    } else {
        // --- Pengguna Logout atau Belum Login ---
        currentUser = null;
        // Tampilkan layar login dan sembunyikan aplikasi
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Event listener untuk tombol login dan logout
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Login Gagal:", error));
});

// Fungsi logout akan kita panggil dari dalam halaman Akun
function handleLogout() {
    if (confirm("Anda yakin ingin logout?")) {
        signOut(auth).catch(error => console.error("Logout Gagal:", error));
    }
}
// Kita 'ekspor' fungsi logout agar bisa diakses oleh tombol di halaman akun nanti
window.handleLogout = handleLogout;


// ==========================================================
// BAGIAN 5: ROUTER SEDERHANA (Navigasi Halaman)
// ==========================================================
function navigateTo(hash) {
    const page = hash.substring(2) || 'utama'; // Ambil nama halaman dari hash, default 'utama'
    
    // Hapus kelas 'active' dari semua link dan tambahkan ke yang diklik
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });

    // Render halaman yang sesuai
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

// Tambahkan event listener untuk setiap tombol navigasi
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
    });
});

// Dengarkan perubahan hash di URL
window.addEventListener('hashchange', () => navigateTo(window.location.hash));

// Export fungsi penting agar bisa diakses Bagian 2
export { appElement, LocalDataManager, currentUser };
// Lanjutan dari app.js...
// Pastikan file ini di-load sebagai module setelah bagian 1.
// Dalam kasus kita, kita gabungkan saja dalam satu file.
// Jadi, anggap kode ini ada di bawah kode sebelumnya.

// Import variabel dari 'bagian 1'
import { appElement, LocalDataManager, currentUser } from './app.js'; // Cara import jika file terpisah

// ==========================================================
// BAGIAN 6: FUNGSI RENDER (Menggambar setiap Halaman)
// ==========================================================

/**
 * Fungsi untuk membuat satu kartu anime dari template
 * @param {object} anime - Objek anime { poster, title, episode }
 * @returns {HTMLElement} - Elemen kartu anime yang sudah jadi
 */
function createAnimeCard(anime) {
    const template = document.getElementById('anime-card-template');
    const card = template.content.cloneNode(true).firstElementChild;
    card.querySelector('.anime-poster').src = anime.poster;
    card.querySelector('.anime-poster').alt = anime.title;
    card.querySelector('.anime-title').textContent = anime.title;
    const episodeElement = card.querySelector('.anime-episode');
    if (anime.episode) {
        episodeElement.textContent = `Terakhir ditonton: ${anime.episode}`;
    } else {
        episodeElement.remove();
    }
    // Tambahkan data-attribute untuk navigasi nanti
    // card.dataset.animeId = anime.id;
    return card;
}


// 6.1. Render Halaman UTAMA
function renderHalamanUtama() {
    // 1. Hero Card (Logo + BG)
    const heroHTML = `
        <div class="card hero-card floating-card">
            <img src="https://files.catbox.moe/03g5k9.gif" class="hero-bg" alt="Hero Background">
            <div class="hero-content">
                <div class="hero-logo img-frame">
                    <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi">
                </div>
                <h2 class="hero-title">Bubuwi-V3</h2>
            </div>
        </div>
    `;

    // 2. Search Card
    const searchHTML = `
        <div class="card search-card floating-card" style="animation-delay: 0.1s;">
            <form id="search-form">
                <input type="search" id="search-input" placeholder="Cari judul anime...">
                <button type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </form>
        </div>
    `;

    // 3. Riwayat Section
    const history = LocalDataManager.getHistory();
    let historyHTML = `<h3 class="section-title">Terakhir Ditonton</h3>`;
    if (history.length > 0) {
        historyHTML += `<div class="anime-grid">`;
        history.forEach(anime => {
            // Kita butuh fungsi untuk membuat kartu dari template
            const card = createAnimeCard(anime);
            card.classList.add('floating-card');
            historyHTML += card.outerHTML;
        });
        historyHTML += `</div>`;
    } else {
        historyHTML += `<p class="empty-state">Belum ada riwayat tontonan.</p>`;
    }

    // 4. Anime Baru Rilis Section
    // NOTE: Logika scraping akan dijalankan di sini. Untuk sekarang, kita pakai data palsu.
    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    // const newReleases = await scrapeNewReleases(); // Panggil fungsi scraping di sini
    newReleaseHTML += `<div class="anime-grid">`;
    // --- Data Dummy ---
    const dummyReleases = [
        { poster: 'https://placehold.co/400x600/1e1e1e/white?text=Poster', title: 'Anime Rilis 1' },
        { poster: 'https://placehold.co/400x600/1e1e1e/white?text=Poster', title: 'Anime Rilis 2' },
        { poster: 'https://placehold.co/400x600/1e1e1e/white?text=Poster', title: 'Anime Rilis 3' },
    ];
    dummyReleases.forEach(anime => {
        const card = createAnimeCard(anime);
        card.classList.add('floating-card');
        newReleaseHTML += card.outerHTML;
    });
    newReleaseHTML += `</div>`;


    // Gabungkan semua bagian dan masukkan ke halaman
    appElement.innerHTML = `
        ${heroHTML}
        ${searchHTML}
        <div class="card">${historyHTML}</div>
        <div class="card">${newReleaseHTML}</div>
    `;
}

// 6.2. Render Halaman SUBSCRIBE
function renderHalamanSubscribe() {
    const subscriptions = LocalDataManager.getSubscriptions();
    let contentHTML = `<h1 class="section-title">Langganan Saya</h1>`;

    if (subscriptions.length > 0) {
        contentHTML += `<div class="anime-grid">`;
        subscriptions.forEach(anime => {
            const card = createAnimeCard(anime);
            // Tambahkan animasi melayang ke setiap kartu
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
    if (!currentUser) return; // Guard clause

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
