// Mengimpor library yang dibutuhkan
const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

// Domain website target yang akan kita scrape
const BASE_URL = 'https://samehadaku.li';

/**
 * Ini adalah fungsi utama (Handler) yang akan dijalankan setiap kali ada request masuk.
 */
const handler = async (req, res) => {
    // Membaca path dan parameter dari URL yang diminta pengguna
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const queryParams = parsedUrl.query;
    
    // Variabel untuk menyimpan HTML final yang akan dikirim ke browser
    let responseHTML = '';

    try {
        // --- Router Sederhana Berbasis Path URL ---
        if (path === '/' || path === '/index.html') {
            responseHTML = await renderHomePage();

        } else if (path.startsWith('/anime/')) {
            const animeLink = `${BASE_URL}${path}`;
            responseHTML = await renderDetailPage(animeLink);

        } else if (path.startsWith('/nonton/')) {
            // Kita ubah path-nya kembali menjadi URL samehadaku yang valid
            const episodeLink = `${BASE_URL}/${path.substring('/nonton/'.length)}`;
            responseHTML = await renderWatchPage(episodeLink);
            
        } else if (path.startsWith('/search')) {
            const query = queryParams.q || '';
            responseHTML = await renderSearchPage(query);

        } else if (path === '/subscribe') {
            responseHTML = await renderSubscribePage();
            
        } else if (path === '/akun') {
            responseHTML = await renderAccountPage();
            
        } else {
            // Jika path tidak cocok dengan rute di atas, tampilkan halaman 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(buildHTMLShell('404 Not Found', `<h1>404: Halaman Tidak Ditemukan</h1>`));
            return;
        }
        
        // Kirimkan HTML yang sudah jadi ke browser pengguna
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(responseHTML);

    } catch (error) {
        // Jika terjadi error saat scraping atau proses lainnya
        console.error('Server Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(buildHTMLShell('Error 500', `<h1>500: Server Error</h1><p>Terjadi kesalahan internal.</p>`));
    }
};
/**
 * Fungsi "cetakan" untuk membuat kerangka dasar setiap halaman HTML.
 * @param {string} pageTitle - Judul halaman yang akan muncul di tab browser.
 * @param {string} contentHTML - Konten utama halaman yang sudah dalam bentuk string HTML.
 * @returns {string} - String HTML lengkap dari atas sampai bawah.
 */
const buildHTMLShell = (pageTitle, contentHTML) => {
    // Navigasi bawah dibuat di sini agar bisa disertakan di setiap halaman
    const navHTML = `
        <nav class="bottom-nav">
            <a href="/" class="nav-link">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>Utama</span>
            </a>
            <a href="/subscribe" class="nav-link">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                <span>Subscribe</span>
            </a>
            <a href="/akun" class="nav-link">
                <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                <span>Akun</span>
            </a>
        </nav>
    `;

    return `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${pageTitle}</title>
            <link rel="stylesheet" href="/style.css">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body>
            <div id="app-container">
                <main id="app">
                    ${contentHTML}
                </main>
                ${navHTML}
            </div>
            <script type="module" src="/app.js"></script>
        </body>
        </html>
    `;
};


/**
 * Fungsi untuk melakukan scrape dan membangun konten Halaman Utama.
 */
async function renderHomePage() {
    // 1. Ambil data HTML dari website target
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    
    // 2. Siapkan string HTML untuk setiap bagian
    const heroHTML = `
        <div class="card hero-card floating-card">
            <img src="https://files.catbox.moe/03g5k9.gif" class="hero-bg" alt="Hero Background">
            <div class="hero-content">
                <div class="hero-logo img-frame"><img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi"></div>
                <h2 class="hero-title">Bubuwi-V3</h2>
            </div>
        </div>`;

    const searchHTML = `
        <div class="card search-card">
            <form action="/search" method="GET">
                <input type="search" name="q" placeholder="Cari judul anime..." required>
                <button type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </form>
        </div>`;

    // Untuk Riwayat, di sistem MPA ini kita akan kelola di sisi klien (frontend) saja
    const historyHTML = `<div class="card" id="history-container"><h3 class="section-title">Terakhir Ditonton</h3><p class="empty-state">Riwayat akan muncul di sini.</p></div>`;

    let newReleaseHTML = `<h3 class="section-title" style="margin-top: 30px;">Baru Rilis</h3>`;
    const newReleaseItems = [];
    $('.listupd article.bs').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.attr('title');
        const link = linkElement.attr('href');
        const thumbnail = $(el).find('img').attr('src');
        const episode = $(el).find('.epx').text().trim();
        
        if (title && link && thumbnail) {
            newReleaseItems.push({ title, link, thumbnail, episode });
        }
    });

    // 3. Bangun grid untuk Rilisan Baru
    if (newReleaseItems.length > 0) {
        newReleaseHTML += `<div class="anime-grid small-grid">`;
        newReleaseItems.forEach(anime => {
            // Kita ubah link-nya agar sesuai format URL kita, misal: /anime/dandadan
            const localLink = `/anime${new URL(anime.link).pathname}`;
            newReleaseHTML += `
                <a href="${localLink}" class="anime-card">
                    <img class="anime-poster" src="${anime.thumbnail}" alt="${anime.title}">
                    <div class="anime-title">${anime.title}</div>
                    <div class="anime-episode">Eps: ${anime.episode}</div>
                </a>
            `;
        });
        newReleaseHTML += `</div>`;
    } else {
        newReleaseHTML += `<p class="empty-state">Tidak ada rilisan baru yang ditemukan.</p>`;
    }

    // 4. Gabungkan semua bagian menjadi satu konten utuh
    const mainContent = `
        ${heroHTML}
        ${searchHTML}
        ${historyHTML}
        <div class="card">${newReleaseHTML}</div>
    `;

    // 5. Masukkan konten ke dalam "cetakan" HTML dan kembalikan hasilnya
    return buildHTMLShell('Bubuwi-V3 | Home', mainContent);
}
/**
 * Fungsi untuk melakukan scrape dan membangun halaman Detail Anime (Daftar Episode).
 * @param {string} animeUrl - URL lengkap halaman seri anime di Samehadaku.
 * @returns {string} - String HTML lengkap untuk halaman detail.
 */
async function renderDetailPage(animeUrl) {
    // 1. Ambil data HTML dari halaman seri anime
    const { data } = await axios.get(animeUrl);
    const $ = cheerio.load(data);

    // 2. Scrape informasi dasar dari halaman
    const title = $('.infox h1.entry-title').text().trim();
    const poster = $('.thumbook .thumb img').attr('src');
    const synopsis = $('.entry-content p').first().text().trim();
    
    const episodes = [];
    $('.eplister ul li').each((i, el) => {
        const linkElement = $(el).find('a');
        const episodeTitle = linkElement.find('.epl-title').text().trim();
        const episodeLink = linkElement.attr('href');
        if (episodeTitle && episodeLink) {
            episodes.push({ title: episodeTitle, link: episodeLink });
        }
    });
    // Balik urutan agar episode 1 di atas
    episodes.reverse();

    // 3. Bangun konten HTML untuk halaman detail
    let contentHTML = `
        <div class="detail-header">
            <div class="img-frame"><img src="${poster}" alt="${title}" class="detail-poster"></div>
            <div class="detail-info">
                <h1 class="detail-title">${title}</h1>
                <p class="episode-count">Total Episode: ${episodes.length}</p>
                <button id="subscribeBtn" class="subscribe-button">⭐ Subscribe</button>
            </div>
        </div>
        <div class="card"><h3 class="section-title">Sinopsis</h3><p>${synopsis}</p></div>
        <div class="card">
            <h2 class="section-title">Daftar Episode</h2>
            <div class="episode-list">
    `;

    if (episodes.length > 0) {
        episodes.forEach(ep => {
            // Ubah link episode menjadi format URL lokal kita, contoh: /nonton/dandadan-episode-1
            const localWatchLink = `/nonton${new URL(ep.link).pathname}`;
            contentHTML += `<a href="${localWatchLink}" class="episode-card">${ep.title}</a>`;
        });
    } else {
        contentHTML += `<p class="empty-state">Daftar episode tidak ditemukan.</p>`;
    }

    contentHTML += `</div></div>`;

    // 4. Masukkan konten ke dalam "cetakan" HTML dan kembalikan
    return buildHTMLShell(`Bubuwi-V3 | ${title}`, contentHTML);
}


/**
 * Fungsi untuk melakukan scrape dan membangun halaman Nonton Video.
 * @param {string} episodeUrl - URL lengkap halaman episode di Samehadaku.
 * @returns {string} - String HTML lengkap untuk halaman nonton.
 */
async function renderWatchPage(episodeUrl) {
    // 1. Ambil data dari halaman episode
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);

    // 2. Scrape informasi yang diperlukan
    const episodeTitle = $('.entry-title').text().trim();
    const animeTitle = $('.item.meta .lm .series a').text().trim();
    const videoSrc = $('#pembed iframe').attr('src');
    
    // Scrape link untuk tombol Prev & Next
    const prevLink = $('.naveps .nvs a[rel="prev"]').attr('href');
    const nextLink = $('.naveps .nvs a[rel="next"]').attr('href');
    
    // Scrape semua episode dari sidebar untuk ditampilkan di bawah
    const allEpisodes = [];
    $('#mainepisode .episodelist ul li').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.find('h3').text().trim();
        const link = linkElement.attr('href');
        if(title && link) {
            allEpisodes.push({ title, link });
        }
    });
    allEpisodes.reverse();

    // 3. Bangun konten HTML untuk halaman nonton
    let contentHTML = `
        <div class="watch-page">
            <div class="watch-header">
                <p class="watch-anime-title">${animeTitle}</p>
                <h1 class="watch-episode-title">${episodeTitle}</h1>
            </div>
    `;

    if (videoSrc) {
        contentHTML += `<div class="video-container"><iframe src="${videoSrc}" frameborder="0" allow="encrypted-media" allowfullscreen></iframe></div>`;
    } else {
        contentHTML += `<p class="empty-state">Video tidak dapat dimuat.</p>`;
    }

    // Buat tombol Prev/Next
    contentHTML += `<div class="watch-nav">`;
    if (prevLink) {
        contentHTML += `<a href="/nonton${new URL(prevLink).pathname}" class="watch-nav-button">❮ Prev</a>`;
    } else {
        contentHTML += `<button class="watch-nav-button" disabled>❮ Prev</button>`;
    }
    if (nextLink) {
        contentHTML += `<a href="/nonton${new URL(nextLink).pathname}" class="watch-nav-button">Next ❯</a>`;
    } else {
        contentHTML += `<button class="watch-nav-button" disabled>Next ❯</button>`;
    }
    contentHTML += `</div>`;

    // Buat grid semua episode
    if (allEpisodes.length > 0) {
        contentHTML += `<div class="card"><h3 class="section-title">Semua Episode</h3><div class="episode-grid-watch">`;
        allEpisodes.forEach(ep => {
            const localEpLink = `/nonton${new URL(ep.link).pathname}`;
            // Tandai episode yang sedang aktif
            const isActive = ep.link === episodeUrl ? 'active' : '';
            const epNumber = ep.title.match(/\d+/g) ? ep.title.match(/\d+/g).join('') : '#';
            contentHTML += `<a href="${localEpLink}" class="episode-grid-button ${isActive}">Eps ${epNumber}</a>`;
        });
        contentHTML += `</div></div>`;
    }
    
    contentHTML += `</div>`;

    // 4. Masukkan konten ke dalam "cetakan" HTML dan kembalikan
    return buildHTMLShell(episodeTitle, contentHTML);
}
/**
 * Fungsi untuk melakukan scrape dan membangun halaman Hasil Pencarian.
 * @param {string} query - Kata kunci pencarian.
 * @returns {string} - String HTML lengkap untuk halaman hasil pencarian.
 */
async function renderSearchPage(query) {
    // String HTML dasar untuk halaman pencarian
    let contentHTML = `
        <h1 class="section-title">Pencarian</h1>
        <div class="card search-card">
            <form action="/search" method="GET">
                <input type="search" name="q" placeholder="Ketik judul anime..." value="${query || ''}" required>
                <button type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </form>
        </div>
    `;

    // Jika tidak ada query, cukup tampilkan halaman dengan form pencarian
    if (!query) {
        return buildHTMLShell('Bubuwi-V3 | Pencarian', contentHTML);
    }

    // Jika ada query, lakukan scraping
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl);
    const $ = cheerio.load(data);
    
    contentHTML += `<h2 class="section-title" style="margin-top:20px;">Hasil untuk: "${query}"</h2>`;
    const searchResults = [];
    $('.listupd article.bs').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.attr('title');
        const link = linkElement.attr('href');
        const thumbnail = $(el).find('img').attr('src');
        if (title && link) {
            searchResults.push({ title, link, thumbnail });
        }
    });

    if (searchResults.length > 0) {
        contentHTML += `<div class="anime-grid">`;
        searchResults.forEach(anime => {
            const localLink = `/anime${new URL(anime.link).pathname}`;
            contentHTML += `
                <a href="${localLink}" class="anime-card">
                    <img class="anime-poster" src="${anime.thumbnail}" alt="${anime.title}">
                    <div class="anime-title">${anime.title}</div>
                </a>
            `;
        });
        contentHTML += `</div>`;
    } else {
        contentHTML += `<p class="empty-state">Tidak ada hasil ditemukan.</p>`;
    }

    return buildHTMLShell(`Hasil untuk ${query}`, contentHTML);
}

// Halaman Subscribe dan Akun dibuat sederhana oleh server,
// karena logika utamanya (mengambil data & menampilkan) akan dijalankan oleh public/app.js di browser.
async function renderSubscribePage() {
    const contentHTML = `
        <h1 class="section-title">Langganan Saya</h1>
        <div class="card">
            <div id="subscription-list">
                <p class="empty-state">Memuat langganan dari perangkat Anda...</p>
            </div>
        </div>
        <script>
            // Script kecil ini akan berjalan di browser pengguna
            document.addEventListener('DOMContentLoaded', () => {
                const subs = JSON.parse(localStorage.getItem('bubuwi_subscriptions')) || [];
                const container = document.getElementById('subscription-list');
                if (subs.length > 0) {
                    let html = '<div class="anime-grid">';
                    subs.forEach(anime => {
                        const localLink = '/anime' + new URL(anime.link).pathname;
                        html += \`<a href="\${localLink}" class="anime-card">
                                    <img class="anime-poster" src="\${anime.poster}" alt="\${anime.title}">
                                    <div class="anime-title">\${anime.title}</div>
                                </a>\`;
                    });
                    html += '</div>';
                    container.innerHTML = html;
                } else {
                    container.innerHTML = '<p class="empty-state">Anda belum berlangganan anime apapun.</p>';
                }
            });
        </script>
    `;
    return buildHTMLShell('Langganan Saya', contentHTML);
}

async function renderAccountPage() {
    const contentHTML = `
        <h1 class="section-title">Akun Saya</h1>
        <div id="user-profile-container">
             <div class="loading-screen"><div class="loader"></div></div>
        </div>
        <div id="dev-contact-container"></div>
    `;
    return buildHTMLShell('Akun Saya', contentHTML);
}


// ==========================================================
// BAGIAN AKHIR: MENJALANKAN SERVER
// ==========================================================
// Membuat server HTTP yang akan menjalankan fungsi handler kita
const server = http.createServer(handler);

// Render akan menyediakan variabel PORT secara otomatis. 
// 3000 adalah fallback jika dijalankan di komputer lokal.
const PORT = process.env.PORT || 3000;

// Mulai server untuk mendengarkan permintaan masuk
server.listen(PORT, () => {
    console.log(\`Server Bubuwi-V3 berjalan di port \${PORT}\`);
});
