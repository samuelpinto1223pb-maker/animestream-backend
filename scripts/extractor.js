const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
};

const JSON_PATH = path.join(__dirname, '../latino.json');

async function extraer() {
  console.log("Iniciando extracción...");
  try {
    const { data } = await axios.get('https://animeflv.net', { headers: HEADERS });
    const $ = cheerio.load(data);
    const catalogo = [];

    $('.ListAnimes article.Anime, .ListListAnime article.Anime, ul.ListAnimes li').each((i, el) => {
      if (i >= 15) return;
      const title = $(el).find('.Title').text().trim();
      let poster = $(el).find('img').attr('src');
      const link = $(el).find('a').attr('href');

      if (title && link) {
        if (poster && !poster.startsWith('http')) {
          poster = 'https://animeflv.net' + poster;
        }
        catalogo.push({
          title: title,
          poster: poster || 'https://via.placeholder.com/300x400',
          idioma: 'Español Latino',
          servers: [
            { title: 'Opción Principal', url: 'https://animeflv.net' + link }
          ]
        });
      }
    });

    console.log(`Extraídos: ${catalogo.length} animes`);
    fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
    console.log("¡Archivo latino.json guardado con éxito!");
  } catch (error) {
    console.error("Error al extraer:", error.message);
  }
}

extraer();
