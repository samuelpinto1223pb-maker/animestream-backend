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

// Función base: Raspa cualquier página del catálogo de AnimeFLV
async function fetchDirectory(page = 1) {
  try {
    const url = `https://animeflv.net/browse?page=${page}`;
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
        
        // Clasificación automática de idioma por título
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
    console.error(`Error en página ${page}:`, error.message);
    return [];
  }
}

// Endpoint 1: Catálogo Completo Auto-actualizable
app.get('/api/animes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const animes = await fetchDirectory(page);
    res.json({ success: true, page: Number(page), count: animes.length, data: animes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Catálogo Exclusivo en Español Latino (Totalmente dinámico)
app.get('/api/latino', async (req, res) => {
  try {
    let animesLatino = [];
    // Rastrea las primeras 8 páginas del sitio sin listas fijas
    for (let p = 1; p <= 8; p++) {
      const items = await fetchDirectory(p);
      const soloLatino = items.filter(anime => anime.idioma === 'Español Latino');
      animesLatino.push(...soloLatino);
    }

    res.json({ success: true, count: animesLatino.length, data: animesLatino });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Búsqueda dinámica por nombre o temporada (Corregido)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ success: false, error: 'Ingresa un nombre para buscar' });

  try {
    const searchUrl = `https://animeflv.net/browse?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    let results = [];

    $('.ListAnimes li, article.Anime').each((_, element) => {
      const title = $(element).find('.Title').text().trim(); // Corregido trim()
      const image = $(element).find('img').attr('src');
      const relativeUrl = $(element).find('a').attr('href');

      if (title && relativeUrl) {
        const id = relativeUrl.replace('/anime/', '');
        const esLatino = title.toLowerCase().includes('latino') || title.toLowerCase().includes('(lat)');
        const fullImage = image && image.startsWith('http') ? image : `https://animeflv.net${image}`; // Corregido comillas invertidas

        results.push({
          id,
          title,
          image: fullImage,
          url: `https://animeflv.net${relativeUrl}`,
          idioma: esLatino ? 'Español Latino' : 'Japonés (Subtitulado)'
        });
      }
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 4: Detalles del Anime, Temporadas y Episodios
app.get('/api/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const url = `https://animeflv.net/anime/${animeId}`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    const title = $('.section-body .Title').text().trim();
    const sinopsis = $('.Plot').text().trim();
    const image = $('.AnimeCover .Image img').attr('src');
    
    // Extracción de episodios desde el script ejecutable interno de la página
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
    
