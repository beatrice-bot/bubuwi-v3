
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');

const BASE_URL = 'https://samehadaku.li';

// Helper function to extract slug from URL
function extractSlug(url) {
  const parts = url.split('/');
  return parts[parts.length - 2] || parts[parts.length - 1];
}

// Scrape homepage for latest releases
async function scrapeHomePage() {
  try {
    const response = await axios.get(BASE_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const releases = [];
    
    $('.releases.latesthome article.bs').each((index, element) => {
      const $element = $(element);
      const link = $element.find('a').attr('href');
      const title = $element.find('.tt').text().trim();
      const thumbnail = $element.find('img').attr('src');
      const episode = $element.find('.epx').text().trim();
      
      if (link && title) {
        releases.push({
          title,
          link,
          thumbnail: thumbnail || '',
          episode: episode || '',
          slug: extractSlug(link)
        });
      }
    });
    
    return releases;
  } catch (error) {
    console.error('Error scraping homepage:', error.message);
    return [];
  }
}

// Search for anime using RSS feed
async function scrapeSearchFeed(query) {
  try {
    const searchUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/feed/rss2/`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const items = result.rss?.channel?.[0]?.item || [];
    return items.map(item => ({
      title: item.title?.[0] || '',
      link: item.link?.[0] || '',
      slug: extractSlug(item.link?.[0] || '')
    }));
  } catch (error) {
    console.error('Error scraping search feed:', error.message);
    return [];
  }
}

// Scrape anime detail page
async function scrapeAnimePage(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('.entry-title').text().trim();
    const thumbnail = $('.thumb img').attr('src') || '';
    const episodes = [];
    
    $('.episodelist ul li').each((index, element) => {
      const $element = $(element);
      const episodeLink = $element.find('a').attr('href');
      const episodeTitle = $element.find('.leftseries .tt').text().trim();
      const episodeNumber = $element.find('.leftseries .tt').text().match(/Episode (\d+)/)?.[1] || (index + 1);
      
      if (episodeLink) {
        episodes.push({
          number: episodeNumber,
          title: episodeTitle,
          link: episodeLink,
          slug: extractSlug(episodeLink)
        });
      }
    });
    
    return {
      title,
      thumbnail,
      episodes: episodes.reverse(), // Reverse to show episode 1 first
      totalEpisodes: episodes.length
    };
  } catch (error) {
    console.error('Error scraping anime page:', error.message);
    return null;
  }
}

// Scrape episode page for video URL
async function scrapeEpisodePage(episodeUrl) {
  try {
    const response = await axios.get(episodeUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('.entry-title').text().trim();
    const videoIframe = $('#player iframe').attr('src') || $('.player-embed iframe').attr('src') || '';
    
    return {
      title,
      videoUrl: videoIframe
    };
  } catch (error) {
    console.error('Error scraping episode page:', error.message);
    return null;
  }
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { search, animePage, url } = event.queryStringParameters || {};

    let result;

    if (search) {
      result = await scrapeSearchFeed(search);
    } else if (animePage) {
      result = await scrapeAnimePage(animePage);
    } else if (url) {
      result = await scrapeEpisodePage(url);
    } else {
      result = await scrapeHomePage();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result
      })
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
