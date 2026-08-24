const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS_HTTP = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

// Función base: Raspa cualquier página del catálogo o búsqueda
async function scrapeAnimeFLV(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    let results = [];

    $('.ListAnimes li, article.Anime').each((_, element) => {
      const title = $(element).find('.Title').text().trim();
      const image = $(element).find('img').attr('src');
      const relativeUrl = $(element).find('a').attr('href');

      if (title && relativeUrl) {
        const id = relativeUrl.replace('/anime/', '');
        const fullImage = image && image.startsWith('http') ? image : `https://animeflv.net${image}`;
        const esLatino = title.toLowerCase().includes('latino') || title.toLowerCase().includes('(lat)');

        results.push({
          id,
          title,
          image: fullImage,
          url: `https://animeflv.net${relativeUrl}`,
          idioma: esLatino ? 'Español Latino' : 'Japonés (Subtitulado)'
        });
      }
    });

    return results;
  } catch (error) {
    console.error(`Error al raspar URL ${url}:`, error.message);
    return [];
  }
}

// Endpoint 1: Catálogo General (Explora TODOS los animes por número de página)
app.get('/api/animes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://animeflv.net/browse?page=${page}`;
    const animes = await scrapeAnimeFLV(url);
    res.json({ success: true, page: Number(page), count: animes.length, data: animes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Catálogo Exclusivo Latino (Extrae directamente de la búsqueda doblada)
app.get('/api/latino', async (req, res) => {
  try {
    let animesLatino = [];
    for (let p = 1; p <= 5; p++) {
      const items = await scrapeAnimeFLV(`https://animeflv.net/browse?q=latino&page=${p}`);
      animesLatino.push(...items);
    }
    res.json({ success: true, count: animesLatino.length, data: animesLatino });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Búsqueda Global (Corregido 'res')
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ success: false, error: 'Ingresa un texto para buscar' });

  try {
    const searchUrl = `https://animeflv.net/browse?q=${encodeURIComponent(query)}`;
    const results = await scrapeAnimeFLV(searchUrl);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 4: Obtener Temporadas y Episodios de un Anime
app.get('/api/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const url = `https://animeflv.net/anime/${animeId}`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    const title = $('.section-body .Title').text().trim();
    const sinopsis = $('.Plot').text().trim();
    const image = $('.AnimeCover .Image img').attr('src');
    
    const scripts = $('script').toArray();
    let episodios = [];

    scripts.forEach(script => {
      const content = $(script).html();
      if (content && content.includes('var episodes =')) {
        const match = content.match(/var episodes = (\[\[.*?\]\]);/);
        if (match && match[1]) {
          const rawEpisodes = JSON.parse(match[1]);
          episodios = rawEpisodes.map(ep => ({
            numero: ep[0],
            id_episodio: `${animeId}-${ep[0]}`,
            url: `https://animeflv.net/ver/${animeId}-${ep[0]}`
          }));
        }
      }
    });

    res.json({
      success: true,
      data: {
        id: animeId,
        title,
        sinopsis,
        image: image ? `https://animeflv.net${image}` : null,
        total_episodios: episodios.length,
        episodios
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor automático en puerto ${PORT}`));
            
