// ==========================================================
// BAGIAN 1: INISIALISASI & IMPORT
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// GANTI DENGAN KONFIGURASI FIREBASE ANDA SENDIRI
const firebaseConfig = {
    apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
    authDomain: "bubuwi-pro.firebaseapp.com",
    projectId: "bubuwi-pro",
    storageBucket: "bubuwi-pro.firebasestorage.app",
    messagingSenderId: "741891119074",
    appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
};
// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);


// ==========================================================
// BAGIAN 2: SELEKTOR DOM
// ==========================================================
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('loginBtn');
const appContainer = document.getElementById('app-container');
const appElement = document.getElementById('app');
const bottomNavElement = document.querySelector('.bottom-nav');


// ==========================================================
// BAGIAN 3: MANAJEMEN DATA LOCALSTORAGE
// ==========================================================
// Objek ini akan mengelola semua data yang disimpan di perangkat pengguna
const LocalDataManager = {
    // Mengambil daftar langganan dari localStorage
    getSubscriptions: () => {
        return JSON.parse(localStorage.getItem('bubuwi_subscriptions')) || [];
    },
    // Menambah anime baru ke daftar langganan
    addSubscription: (anime) => {
        const subs = LocalDataManager.getSubscriptions();
        // Cek agar tidak ada judul yang sama (duplikat)
        if (!subs.some(s => s.title === anime.title)) {
            subs.push(anime);
            localStorage.setItem('bubuwi_subscriptions', JSON.stringify(subs));
            alert(`${anime.title} telah ditambahkan ke langganan!`);
        } else {
            alert(`${anime.title} sudah ada di daftar langganan.`);
        }
    },
    // Mengambil riwayat tontonan
    getHistory: () => {
        return JSON.parse(localStorage.getItem('bubuwi_history')) || [];
    },
    // Menambah atau memperbarui riwayat tontonan
    addHistory: (anime) => {
        let history = LocalDataManager.getHistory();
        // Hapus entri lama jika judulnya sama, agar hanya ada yang terbaru
        history = history.filter(h => h.title !== anime.title);
        // Tambahkan yang baru di awal array (paling atas)
        history.unshift(anime);
        // Batasi riwayat, misal 20 item terakhir untuk menghemat ruang
        if (history.length > 20) {
            history.pop();
        }
        localStorage.setItem('bubuwi_history', JSON.stringify(history));
    }
};
// ==========================================================
// BAGIAN 4: AUTENTIKASI FIREBASE
// ==========================================================
// Variabel untuk menyimpan data pengguna yang sedang login
let currentUser = null;

// Fungsi ini adalah pusat kendali aplikasi.
// Ia akan berjalan otomatis saat halaman dimuat dan setiap kali status login berubah.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- KONDISI SAAT PENGGUNA BERHASIL LOGIN ---
        currentUser = user;

        // Simpan atau perbarui info pengguna di Firebase Database (opsional tapi bagus)
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

        // Arahkan ke halaman yang sesuai (default ke halaman utama)
        navigateTo(window.location.hash || '#/');

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
// BAGIAN 5: ROUTER & NAVIGASI
// ==========================================================

// Fungsi untuk menggambar ulang navigasi bawah dan menandai halaman aktif
const renderNav = (activePage) => {
    bottomNavElement.innerHTML = `
        <a href="#/" data-page="utama" class="nav-link ${activePage === 'utama' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>Utama</span>
        </a>
        <a href="#/subscribe" data-page="subscribe" class="nav-link ${activePage === 'subscribe' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            <span>Subscribe</span>
        </a>
        <a href="#/akun" data-page="akun" class="nav-link ${activePage === 'akun' ? 'active' : ''}">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>Akun</span>
        </a>
    `;
};

// Fungsi utama untuk navigasi halaman
function navigateTo(hash) {
    const page = hash.substring(2) || 'utama';
    
    // Gambar ulang navigasi dan tandai yang aktif
    renderNav(page);

    // Scroll ke atas setiap pindah halaman
    window.scrollTo(0, 0);

    // Render halaman yang sesuai berdasarkan 'page'
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
            renderHalamanUtama(); // Halaman default jika hash tidak dikenali
            break;
    }
}

// Event listener untuk tombol navigasi bawah
bottomNavElement.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (navLink) {
        e.preventDefault();
        // Ubah hash di URL untuk memicu 'hashchange'
        window.location.hash = navLink.getAttribute('href');
    }
});

// Dengarkan perubahan pada hash di URL (misal: saat menekan tombol back/forward browser)
window.addEventListener('hashchange', () => navigateTo(window.location.hash));
// ==========================================================
// BAGIAN 6: FUNGSI RENDER (Menggambar setiap Halaman)
// ==========================================================

/**
 * Fungsi untuk membuat satu kartu anime dari template HTML.
 * @param {object} anime - Objek yang berisi info anime (title, poster, episode, link).
 * @returns {HTMLElement} - Elemen HTML kartu anime yang siap ditampilkan.
 */
function createAnimeCard(anime) {
    const template = document.getElementById('anime-card-template');
    const card = template.content.cloneNode(true).firstElementChild;

    // Mengisi data ke dalam elemen kartu
    card.querySelector('.anime-poster').src = anime.poster || 'https://placehold.co/400x600/1e1e1e/white?text=No+Image';
    card.querySelector('.anime-poster').alt = anime.title;
    card.querySelector('.anime-title').textContent = anime.title;
    
    const episodeElement = card.querySelector('.anime-episode');
    if (anime.episode) {
        episodeElement.textContent = `Terakhir ditonton: ${anime.episode}`;
    } else {
        // Jika tidak ada info episode, hapus elemennya agar tidak memakan ruang
        episodeElement.remove();
    }

    // Menambahkan event listener agar kartu bisa diklik
    card.addEventListener('click', () => {
        // Untuk sekarang, kita hanya tampilkan alert.
        // Nanti di sini akan ada logika untuk pindah ke halaman detail anime.
        alert(`Anda mengklik: ${anime.title}\nLink dari API: ${anime.link || 'Tidak ada'}`);
        
        // Contoh menambahkan anime ke riwayat saat diklik
        if (anime.link) { // Pastikan ada data anime lengkap sebelum disimpan
            LocalDataManager.addHistory({
                title: anime.title,
                poster: anime.poster,
                link: anime.link,
                episode: anime.episode || 'Episode terakhir' // Contoh
            });
        }
    });

    return card;
}


/**
 * Fungsi untuk merender seluruh konten Halaman Utama.
 */
async function renderHalamanUtama() {
    // 1. Tampilkan loader dulu agar pengguna tahu ada proses yang berjalan
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
            // Kita panggil createAnimeCard untuk setiap item riwayat
            historyHTML += createAnimeCard(anime).outerHTML;
        });
        historyHTML += `</div>`;
    } else {
        historyHTML += `<p class="empty-state">Belum ada riwayat tontonan.</p>`;
    }

    // 4. Ambil data Rilisan Baru dari API dan siapkan HTML-nya
    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    try {
        const response = await fetch('/.netlify/functions/scrape');
        if (!response.ok) {
            throw new Error(`Gagal mengambil data rilis baru. Status: ${response.status}`);
        }
        const newReleases = await response.json();
        
        let animeCardsHTML = '';
        if(newReleases.results && newReleases.results.length > 0){
             newReleases.results.forEach(anime => {
                animeCardsHTML += createAnimeCard({
                    poster: anime.thumbnail,
                    title: anime.seriesTitle,
                    link: anime.link,
                    episode: anime.episode
                }).outerHTML;
            });
            newReleaseHTML += `<div class="anime-grid small-grid">${animeCardsHTML}</div>`;
        } else {
            throw new Error('API tidak mengembalikan hasil rilis baru.');
        }
    } catch (error) {
        console.error("Error fetching new releases:", error);
        newReleaseHTML += `<p class="empty-state">Gagal memuat data rilis baru.</p>`;
    }
    
    // 5. Gabungkan semua HTML yang sudah disiapkan dan render ke DOM sekaligus
    appElement.innerHTML = `
        ${heroHTML}
        ${searchHTML}
        <div class="card">${historyHTML}</div>
        <div class="card" id="search-results-section">${newReleaseHTML}</div>
    `;

    // 6. Tambahkan event listener untuk form pencarian SETELAH elemennya ada di DOM
    document.getElementById('search-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        const resultsSection = document.getElementById('search-results-section');
        resultsSection.innerHTML = `<div class="loader"></div><p style="text-align:center;">Mencari "${query}"...</p>`;
        try {
            const response = await fetch(`/.netlify/functions/scrape?search=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`Gagal melakukan pencarian. Status: ${response.status}`);
            }
            const searchResults = await response.json();
            
            let searchResultHTML = `<h3 class="section-title">Hasil Pencarian</h3>`;
            if (searchResults.results && searchResults.results.length > 0) {
                 searchResultHTML += `<div class="anime-grid">`;
                 searchResults.results.forEach(anime => {
                     searchResultHTML += createAnimeCard({
                         poster: anime.thumbnail, // Thumbnail dari pencarian mungkin null
                         title: anime.title,
                         link: anime.link
                     }).outerHTML;
                 });
                 searchResultHTML += `</div>`;
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
 * Mengambil data dari localStorage dan menampilkannya.
 */
function renderHalamanSubscribe() {
    const subscriptions = LocalDataManager.getSubscriptions();
    let contentHTML = `<h1 class="section-title">Langganan Saya</h1>`;

    if (subscriptions.length > 0) {
        contentHTML += `<div class="anime-grid">`;
        subscriptions.forEach(anime => {
            const card = createAnimeCard(anime);
            // Tambahkan animasi melayang dengan delay acak agar terlihat lebih hidup
            card.style.animationDelay = `${Math.random() * 0.5}s`;
            contentHTML += card.outerHTML;
        });
        contentHTML += `</div>`;
    } else {
        // Tampilkan pesan jika tidak ada langganan
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
 * Mengambil data dari currentUser (Firebase) dan menampilkannya.
 */
function renderHalamanAkun() {
    // Pastikan pengguna sudah login sebelum merender halaman ini
    if (!currentUser) return;

    // Siapkan HTML untuk setiap kartu di halaman Akun
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
    
    // Gabungkan semua HTML dan render ke DOM
    appElement.innerHTML = `
        ${userCardHTML}
        ${devContactHTML}
        ${logoutButtonHTML}
    `;
}
