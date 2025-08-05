// netlify/functions/scrape.js (Versi Final Anti-Crash)

const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://samehadaku.li';

const createResponse = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Fungsi untuk mengambil HTML dengan timeout yang jelas
async function getHTML(url) {
    try {
        // Beri batas waktu 8 detik. Jika lebih, akan gagal.
        const response = await axios.get(url, { timeout: 8000 });
        return response.data;
    } catch (error) {
        // Jika error karena timeout, beri pesan yang jelas.
        if (error.code === 'ECONNABORTED') {
            console.error(`Timeout saat mencoba mengakses: ${url}`);
            throw new Error('Request Timeout');
        }
        console.error(`Gagal mengambil HTML dari ${url}:`, error.message);
        throw new Error('Failed to fetch HTML');
    }
}

async function scrapeHomepage() {
    const data = await getHTML(BASE_URL);
    const $ = cheerio.load(data);
    let latest = [];
    let trending = {};

    // Scrape Trending dengan proteksi error
    try {
        const trendingEl = $('.trending .tdb a');
        if (trendingEl.length) {
            const style = $('.imgxb').attr('style');
            const poster = style ? style.match(/url\('(.*?)'\)/)[1] : '';
            trending = {
                title: trendingEl.find('.numb b').text().trim(),
                url: trendingEl.attr('href'),
                poster: poster
            };
        }
    } catch (e) {
        console.error("Gagal scrape bagian Trending:", e.message);
        trending = { error: "Gagal memuat trending." };
    }

    // Scrape Rilis Terbaru dengan proteksi error
    try {
        $('.listupd.normal .bs').each((i, el) => {
            const item = $(el).find('.bsx a');
            if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
                latest.push({ title: item.attr('title'), url: item.attr('href'), poster: item.find('img').attr('src'), episode: item.find('.epx').text().trim() });
            }
        });
    } catch (e) {
        console.error("Gagal scrape bagian Rilis Terbaru:", e.message);
        if (latest.length === 0) latest.push({ error: "Gagal memuat rilis terbaru." });
    }
    
    return { trending, latest };
}

async function scrapeEpisodes(url) {
    const data = await getHTML(decodeURIComponent(url));
    const $ = cheerio.load(data);
    const episodes = [];
    $('#mainepisode .episodelist ul li').each((i, el) => {
        const item = $(el).find('a');
        if (item.find('h3').text().trim() && item.attr('href')) {
            episodes.push({ title: item.find('h3').text().trim(), url: item.attr('href') });
        }
    });
    return {
        title: $('.single-info .infox .infolimit h2').text().trim(),
        poster: $('.single-info .thumb img').attr('src'),
        synopsis: $('.desc.mindes').text().trim(),
        episodes: episodes.reverse(),
    };
}

async function scrapeWatch(url) {
    const data = await getHTML(decodeURIComponent(url));
    const $ = cheerio.load(data);
    return {
        videoEmbedUrl: $('#pembed iframe').attr('src'),
        prevEpisodeUrl: $('.naveps .nvs a[rel="prev"]').attr('href'),
        nextEpisodeUrl: $('.naveps .nvs a[rel="next"]').attr('href'),
    };
}

exports.handler = async (event) => {
  const { target, url } = event.queryStringParameters;
  console.log(`[INFO] Function dipanggil dengan target: ${target}`);
  try {
    let responseData;
    if (target === 'home') responseData = await scrapeHomepage();
    else if (target === 'episodes') responseData = await scrapeEpisodes(url);
    else if (target === 'watch') responseData = await scrapeWatch(url);
    else return createResponse({ error: 'Invalid target' }, 400);
    
    console.log(`[SUCCESS] Berhasil scrape target: ${target}`);
    return createResponse(responseData);

  } catch (error) {
    console.error(`[FATAL ERROR] Gagal total pada target ${target}:`, error.message);
    return createResponse({ error: `Sumber data tidak merespon atau error: ${error.message}` }, 504); // 504 Gateway Timeout
  }
};
