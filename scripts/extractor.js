const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HEADERS_HTTP = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://animeflv.net/'
};

const JSON_PATH = path.join(__dirname, '../latino.json');

async function obtenerVideosEpisodio(idAnime, numEpisodio) {
  try {
    const url = `https://animeflv.net/ver/${idAnime}-${numEpisodio}`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    
    const match = data.match(/var\s+videos\s*=\s*(\{[\s\S]*?\});/);
    if (match && match[1]) {
      const videosData = JSON.parse(match[1]);
      const servidores = videosData.SUB || videosData.LAT || [];
      return servidores.map(s => ({
        server: s.server,
        title: s.title || s.server,
        code: s.code
      }));
    }
  } catch (e) {}
  return [];
}

async function iniciarExtraccion() {
  console.log("Iniciando extracción automática en GitHub Actions...");
  let catalogo = [];

  try {
    const { data } = await axios.get('https://animeflv.net/browse?type%5B%5D=tv&order=default&page=1', { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    const listaAnimes = [];

    $('article.Anime').each((_, el) => {
      const title = $(el).find('.Title').text().trim();
      const image = $(el).find('img').attr('src');
      const relativeUrl = $(el).find('a').attr('href');
      if (title && relativeUrl) {
        listaAnimes.push({
          id: relativeUrl.replace('/anime/', ''),
          title,
          image: image.startsWith('http') ? image : `https://animeflv.net${image}`,
          idioma: 'Español Latino'
        });
      }
    });

    for (let anime of listaAnimes) {
      anime.episodios = {};
      for (let ep = 1; ep <= 2; ep++) {
        const servers = await obtenerVideosEpisodio(anime.id, ep);
        if (servers.length > 0) {
          anime.episodios[ep] = servers;
        }
      }
      catalogo.push(anime);
      await new Promise(r => setTimeout(r, 500));
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
    console.log("¡Catálogo actualizado correctamente!");
  } catch (err) {
    console.error("Error en la extracción:", err);
  }
}

iniciarExtraccion();
