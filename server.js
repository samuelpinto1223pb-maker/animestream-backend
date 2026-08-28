const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS_HTTP = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

// Endpoint 1: Catálogo mediante API pública sin bloqueos de Cloudflare
app.get('/api/latino', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const { data } = await axios.get(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=24`);

    const resultados = data.data.map(anime => {
      const title = anime.title;
      const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return {
        id: cleanSlug,
        title: title,
        image: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
        url: anime.url,
        idioma: title.toLowerCase().includes('latino') ? 'Español Latino' : 'Japonés / Sub',
        esLatino: title.toLowerCase().includes('latino')
      };
    });

    res.json({
      success: true,
      page: page,
      total_registrados: 2800,
      count: resultados.length,
      data: resultados
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Detalles y Episodios
app.get('/api/anime/:id', async (req, res) => {
  try {
    const cleanId = req.params.id.replace('/anime/', '').replace(/\//g, '');
    const url = 'https://animeflv.net/anime/' + cleanId;
    
    const response = await axios.get(url, { headers: HEADERS_HTTP, timeout: 8000 });
    const $ = cheerio.load(response.data);
    const title = $('.section-body .Title').text().trim() || $('h1.Title').text().trim();
    const image = $('.AnimeCover .Image img').attr('src');

    let episodes = [];
    const scripts = $('script');

    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.includes('var episodes =')) {
        const epData = content.match(/var episodes = (\[\[.*?\]\]);/);
        if (epData && epData[1]) {
          const parsedEps = JSON.parse(epData[1]);
          episodes = parsedEps.map(ep => ({
            number: ep[0],
            id: cleanId + '-' + ep[0]
          }));
        }
      }
    });

    res.json({
      success: true,
      data: {
        id: cleanId,
        title: title || cleanId,
        image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
        episodes: episodes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Servidores
app.get('/api/ver/:episodeId', async (req, res) => {
  try {
    const episodeId = req.params.episodeId;
    const url = 'https://animeflv.net/ver/' + episodeId;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP, timeout: 8000 });
    const $ = cheerio.load(data);

    let servers = [];
    const scripts = $('script');

    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.includes('var videos =')) {
        const videoData = content.match(/var videos = (\{.*?\});/);
        if (videoData && videoData[1]) {
          const parsed = JSON.parse(videoData[1]);
          servers = (parsed && (parsed.LAT || parsed.SUB)) || [];
        }
      }
    });

    res.json({
      success: true,
      episodeId: episodeId,
      servers: servers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 4: Buscador
app.get('/api/buscar', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ success: false, error: 'Término requerido' });
    
    const { data } = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20`);
    const resultados = data.data.map(anime => ({
      id: anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: anime.title,
      image: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
      url: anime.url,
      idioma: anime.title.toLowerCase().includes('latino') ? 'Español Latino' : 'Japonés / Sub',
      esLatino: anime.title.toLowerCase().includes('latino')
    }));

    res.json({ success: true, count: resultados.length, data: resultados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Servidor activo en el puerto ' + PORT);
});
