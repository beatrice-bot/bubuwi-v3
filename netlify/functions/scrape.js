const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://samehadaku.li';

const createResponse = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function getHTML(url) {
    try {
        const response = await axios.get(url, { timeout: 8000 });
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') throw new Error('Request Timeout');
        throw new Error('Failed to fetch HTML');
    }
}

async function scrapeHomepage() {
    const html = await getHTML(BASE_URL);
    const $ = cheerio.load(html);
    const latest = [];
    let trending = {};

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
    } catch (e) { console.error("Gagal scrape Trending:", e.message); }

    $('.listupd.normal .bs').each((i, el) => {
        const item = $(el).find('.bsx a');
        if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
            latest.push({ title: item.attr('title'), url: item.attr('href'), poster: item.find('img').attr('src'), episode: item.find('.epx').text().trim() });
        }
    });
    return { trending, latest };
}

async function scrapeSearch(query) {
    const html = await getHTML(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];
    $('.listupd .bs').each((i, el) => {
        const item = $(el).find('.bsx a');
        if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
            results.push({ title: item.attr('title'), url: item.attr('href'), poster: item.find('img').attr('src'), episode: item.find('.epx').text().trim() });
        }
    });
    return results;
}

async function scrapeEpisodes(url) {
    const html = await getHTML(decodeURIComponent(url));
    const $ = cheerio.load(html);
    const episodes = [];
    $('.eplister ul li').each((i, el) => {
        const item = $(el).find('a');
        if (item.find('.epl-title').text().trim() && item.attr('href')) {
            episodes.push({ title: item.find('.epl-title').text().trim(), url: item.attr('href') });
        }
    });
    return {
        title: $('.infox h1.entry-title').text().trim(),
        poster: $('.thumbook .thumb img').attr('src'),
        synopsis: $('.entry-content p').text().trim(),
        episodes: episodes.reverse(),
    };
}

async function scrapeWatch(url) {
    const html = await getHTML(decodeURIComponent(url));
    const $ = cheerio.load(html);
    return {
        videoEmbedUrl: $('#pembed iframe').attr('src'),
        prevEpisodeUrl: $('.naveps a[rel="prev"]').attr('href'),
        nextEpisodeUrl: $('.naveps a[rel="next"]').attr('href'),
    };
}

exports.handler = async (event) => {
  const { target, url, query } = event.queryStringParameters;
  try {
    let responseData;
    if (target === 'home') responseData = await scrapeHomepage();
    else if (target === 'episodes') responseData = await scrapeEpisodes(url);
    else if (target === 'watch') responseData = await scrapeWatch(url);
    else if (target === 'search') responseData = await scrapeSearch(query);
    else return createResponse({ error: 'Invalid target' }, 400);
    return createResponse(responseData);
  } catch (error) {
    console.error(`Scraping Error on target ${target}:`, error.message);
    return createResponse({ error: `Sumber data tidak merespon atau error: ${error.message}` }, 504);
  }
};
