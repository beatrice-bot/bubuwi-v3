const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://samehadaku.li';

const createResponse = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function scrapeHomepage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    const slider = [], latest = [], popularWeekly = [];

    $('.slidtop .loop .slide-item').each((i, el) => {
        const item = $(el).find('.poster a');
        const title = $(el).find('.info-left .title a').text().trim();
        if (title && item.attr('href') && item.find('img').attr('src')) {
            slider.push({ title, url: item.attr('href'), poster: item.find('img').attr('src') });
        }
    });
    $('.listupd.normal .bs').each((i, el) => {
        const item = $(el).find('.bsx a');
        if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
            latest.push({ title: item.attr('title'), url: item.attr('href'), poster: item.find('img').attr('src'), episode: item.find('.epx').text().trim() });
        }
    });
    $('#wpop-items .wpop-weekly ul li').each((i, el) => {
        const item = $(el).find('a.series');
        if (item.attr('title') && item.attr('href') && item.find('img').attr('src')) {
            popularWeekly.push({ rank: $(el).find('.ctr').text().trim(), title: item.attr('title'), url: item.attr('href'), poster: item.find('img').attr('src') });
        }
    });
    return { slider, latest, popularWeekly };
}

async function scrapeEpisodes(url) {
    const { data } = await axios.get(decodeURIComponent(url));
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
    const { data } = await axios.get(decodeURIComponent(url));
    const $ = cheerio.load(data);
    return {
        videoEmbedUrl: $('#pembed iframe').attr('src'),
        prevEpisodeUrl: $('.naveps .nvs a[rel="prev"]').attr('href'),
        nextEpisodeUrl: $('.naveps .nvs a[rel="next"]').attr('href'),
    };
}

exports.handler = async (event) => {
  const { target, url } = event.queryStringParameters;
  try {
    if (target === 'home') return createResponse(await scrapeHomepage());
    if (target === 'episodes') return createResponse(await scrapeEpisodes(url));
    if (target === 'watch') return createResponse(await scrapeWatch(url));
    return createResponse({ error: 'Invalid target' }, 400);
  } catch (error) {
    console.error(`Scraping Error on target ${target}:`, error.message);
    return createResponse({ error: 'Failed to scrape data from the source.' }, 500);
  }
};
