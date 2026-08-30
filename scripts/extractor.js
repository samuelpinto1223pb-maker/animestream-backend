const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JSON_PATH = path.join(__dirname, '../latino.json');
const BASE_URL = 'https://animeflv.net';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9'
};

async function fetchPage(url) {
  try {
    const res = await axios.get(url, { headers, timeout: 12000 });
    return cheerio.load(res.data);
  } catch (e) {
    return null;
  }
}

async function runExtractor() {
  console.log('🚀 Extrayendo catálogo con reproductores optimizados...');
  
  const $ = await fetchPage(`${BASE_URL}/browse?order=added`);
  if (!$) {
    console.log('⚠️ Fuente no disponible temporalmente. Manteniendo datos actuales.');
    return;
  }

  const catalog = [];
  const animeLinks = [];

  $('.ListAnimes li article a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && i < 10) animeLinks.push(href);
  });

  for (const link of animeLinks) {
    const $anime = await fetchPage(`${BASE_URL}${link}`);
    if (!$anime) continue;

    const title = $anime('.Ficha h1').text().trim() || 'Anime';
    const poster = $anime('.Image img').attr('src') || '';
    const fullPoster = poster.startsWith('http') ? poster : `${BASE_URL}${poster}`;
    const year = $anime('.NIGHT').text().trim() || '2026';

    let episodesData = [];
    $anime('script').each((i, el) => {
      const content = $anime(el).html();
      if (content && content.includes('var episodes =')) {
        const epMatch = content.match(/var episodes = (\[\[.*?\]\]);/);
        if (epMatch) {
          try { episodesData = JSON.parse(epMatch[1]); } catch (e) {}
        }
      }
    });

    const capitulos = episodesData.map(ep => {
      const epNum = ep[0];
      const epId = ep[1];

      return {
        numero: epNum,
        opciones_reproductor: [
          {
            idioma: 'Español Latino',
            servidor: 'Streamwish (Latino)',
            url: `https://streamwish.to/e/${epId}`
          },
          {
            idioma: 'Español Latino',
            servidor: 'Voe (Latino)',
            url: `https://voe.sx/e/${epId}`
          },
          {
            idioma: 'Español Castellano',
            servidor: 'Filemoon (Castellano)',
            url: `https://filemoon.sx/e/${epId}`
          }
        ]
      };
    });

    if (capitulos.length > 0) {
      catalog.push({ title, poster: fullPoster, year, capitulos });
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  if (catalog.length > 0) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`✅ Extracción completada: ${catalog.length} animes guardados.`);
  }
}

runExtractor();
