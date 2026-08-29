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
      const servidoras = (videosData.LAT || videosData.SUB || []);
      return servidoras.map(s => ({
        server: s.server,
        title: s.title || s.server,
        code: s.code || s.url
      }));
    }
  } catch (e) {
    // Si falla un episodio continúa silenciosamente
  }
  return [];
}

async function iniciarExtraccion() {
  console.log("Iniciando extracción de animes latinos en GitHub Actions...");
  let catalogo = [];

  try {
    // Buscar directamente por la etiqueta "Latino" en AnimeFLV
    const searchUrl = 'https://animeflv.net/browse?q=latino';
    const { data } = await axios.get(searchUrl, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    const listaAnimes = [];

    $('.ListAnimes article.Anime, ul.ListAnimes li article').each((_, el) => {
      const title = $(el).find('.Title').text().trim();
      let image = $(el).find('img').attr('src') || $(el).find('img').attr('data-cfsrc');
      const relativeUrl = $(el).find('a').attr('href');

      if (title && relativeUrl) {
        if (image && !image.startsWith('http')) {
          image = 'https://animeflv.net' + image;
        }

        listaAnimes.push({
          id: relativeUrl.replace('/anime/', ''),
          title: title,
          poster: image || 'https://via.placeholder.com/400x200/1a1d28/ff2e63?text=Anime+Latino',
          idioma: 'Español Latino'
        });
      }
    });

    console.log(`Animes encontrados: ${listaAnimes.length}`);

    // Tomar los primeros 15 animes latinos para no saturar la ejecución
    const seleccion = listaAnimes.slice(0, 15);

    for (let anime of seleccion) {
      console.log(`Procesando: ${anime.title}`);
      const servers = await obtenerVideosEpisodio(anime.id, 1);
      
      catalogo.push({
        title: anime.title,
        poster: anime.poster,
        idioma: anime.idioma,
        servers: servers
      });

      await new Promise(r => setTimeout(r, 400));
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
    console.log("¡Catálogo Latino actualizado correctamente!");

  } catch (err) {
    console.error("Error durante la extracción:", err);
  }
}

iniciarExtraccion();
