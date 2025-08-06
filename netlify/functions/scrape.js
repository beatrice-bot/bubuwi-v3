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
        throw new Error(`Failed to fetch HTML from ${url}`);
    }
}

// HANYA MENGAMBIL RILIS TERBARU, CEPAT DAN STABIL
async function scrapeHomepage() {
    const html = await getHTML(BASE_URL);
    const $ = cheerio.load(html);
    const latest = [];
    $('.listupd.normal .bs').each((i, el) => {
        const item = $(el).find('.bsx a');
        if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
            latest.push({ 
                title: item.attr('title').replace(/ Nonton.*/, ''),
                seriesTitle: item.find('.tt').clone().children().remove().end().text().trim(),
                url: item.attr('href'), 
                poster: item.find('img').attr('src'), 
                episode: item.find('.epx').text().trim() 
            });
        }
    });
    return { latest };
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
        synopsis: $('.entry-content p').first().text().trim(),
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
  const { target, url } = event.queryStringParameters;
  try {
    let data;
    if (target === 'home') data = await scrapeHomepage();
    else if (target === 'episodes') data = await scrapeEpisodes(url);
    else if (target === 'watch') data = await scrapeWatch(url);
    else return createResponse({ error: 'Invalid target' }, 400);
    return createResponse(data);
  } catch (error) {
    console.error(`Scraping Error on target ${target}:`, error.message);
    return createResponse({ error: `Sumber data error: ${error.message}` }, 500);
  }
};
