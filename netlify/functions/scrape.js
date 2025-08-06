const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');

// Ganti BASE_URL jika domain target berubah
const BASE_URL = 'https://samehadaku.li';

// Fungsi utama yang akan dijalankan oleh Netlify
exports.handler = async function (event, context) {
    // Ambil parameter dari URL (?search=..., ?animePage=..., ?url=...)
    const { search, animePage, url } = event.queryStringParameters;

    try {
        let data;
        if (search) {
            // Jika ada parameter 'search', jalankan fungsi scrape untuk pencarian
            data = await scrapeSearchPage(search);
        } else if (animePage) {
            // Jika ada parameter 'animePage', jalankan fungsi scrape untuk halaman detail (daftar episode)
            data = await scrapeAnimePage(animePage);
        } else if (url) {
            // Jika ada parameter 'url', jalankan fungsi scrape untuk halaman nonton (mencari video)
            data = await scrapeEpisodePage(url);
        } else {
            // Jika tidak ada parameter, jalankan fungsi scrape untuk halaman utama (rilis baru)
            data = await scrapeHomePage();
        }
        // Kembalikan data dalam format JSON dengan status sukses
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        // Jika terjadi error, catat di log dan kembalikan pesan error
        console.error('Scraping error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

/**
 * Mengambil data dari Halaman Utama (Rilisan Terbaru)
 */
async function scrapeHomePage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    const latestReleases = [];

    // Cari setiap 'article' di dalam 'div' dengan class 'listupd'
    $('.listupd article.bs').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.attr('title');
        const link = linkElement.attr('href');
        const thumbnail = $(el).find('img').attr('src');
        const episode = $(el).find('.epx').text().trim();
        
        if (title && link && thumbnail) {
            latestReleases.push({
                seriesTitle: title,
                link,
                thumbnail,
                episode,
            });
        }
    });
    return { type: 'latest', results: latestReleases };
}

/**
 * Mengambil data dari Halaman Pencarian
 * Berdasarkan file 'bagiansaatpencarian.html'
 */
async function scrapeSearchPage(query) {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl);
    const $ = cheerio.load(data);
    const results = [];

    // Di halaman pencarian, setiap hasil ada di dalam elemen 'article'
    $('.listupd article.bs').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.attr('title');
        const link = linkElement.attr('href');
        // PENTING: halaman pencarian menyediakan gambar, jadi kita ambil
        const thumbnail = $(el).find('img').attr('src');
        
        if (title && link) {
            results.push({ title, link, thumbnail });
        }
    });

    return { type: 'search', query, results };
}


/**
 * Mengambil data dari Halaman Detail Anime (Daftar Episode)
 * Berdasarkan file 'bagiansaatpemilihanepisode.html'
 */
async function scrapeAnimePage(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const episodes = [];

    // Cari setiap 'li' di dalam 'div' dengan class 'eplister'
    $('.eplister ul li').each((i, el) => {
        const linkElement = $(el).find('a');
        const title = linkElement.find('.epl-title').text().trim();
        const link = linkElement.attr('href');
        if(title && link) {
            episodes.push({ title, link });
        }
    });

    const thumbnail = $('.thumbook .thumb img').attr('src');
    
    // Reverse array agar episode 1 ada di paling atas
    episodes.reverse(); 

    return {
        type: 'animePage',
        episodes,
        thumbnail,
        episodeCount: episodes.length,
    };
}

/**
 * Mengambil data dari Halaman Nonton (Link Video Iframe)
 * Berdasarkan file 'bagiansaatnontonanime.html'
 */
async function scrapeEpisodePage(episodeUrl) {
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);
    
    const title = $('.entry-title').text().trim();
    const videoFrames = [];

    // Cari setiap 'iframe' di dalam 'div' dengan id 'pembed'
    $('#pembed iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
            videoFrames.push(src);
        }
    });

    return {
        type: 'episode',
        title,
        videoFrames,
    };
}
