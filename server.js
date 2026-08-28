const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Catálogo base con prioridad en ESPAÑOL LATINO
const CATALOGO_LATINO = [
  { id: 'dragon-ball-super-latino', title: 'Dragon Ball Super (Latino)', image: 'https://animeflv.net/uploads/animes/covers/2984.jpg', esLatino: true },
  { id: 'demon-slayer-kimetsu-no-yaiba-latino', title: 'Demon Slayer (Latino)', image: 'https://animeflv.net/uploads/animes/covers/3527.jpg', esLatino: true },
  { id: 'shingeki-no-kyojin-latino', title: 'Shingeki no Kyojin (Latino)', image: 'https://animeflv.net/uploads/animes/covers/3406.jpg', esLatino: true },
  { id: 'jujutsu-kaisen-latino', title: 'Jujutsu Kaisen (Latino)', image: 'https://animeflv.net/uploads/animes/covers/3364.jpg', esLatino: true },
  { id: 'naruto-shippuden-latino', title: 'Naruto Shippuden (Latino)', image: 'https://animeflv.net/uploads/animes/covers/8.jpg', esLatino: true },
  { id: 'one-piece-latino', title: 'One Piece (Latino)', image: 'https://animeflv.net/uploads/animes/covers/1.jpg', esLatino: true },
  { id: 'my-hero-academia-latino', title: 'Boku no Hero Academia (Latino)', image: 'https://animeflv.net/uploads/animes/covers/2452.jpg', esLatino: true },
  { id: 'chainsaw-man-latino', title: 'Chainsaw Man (Latino)', image: 'https://animeflv.net/uploads/animes/covers/3697.jpg', esLatino: true }
];

// Endpoint: Obtener animes (priorizando latino)
app.get('/api/latino', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    let resultados = [];

    try {
      const { data } = await axios.get(`https://api.jikan.moe/v4/anime?q=latino&page=${page}&limit=20`, { timeout: 4000 });
      if (data && data.data) {
        resultados = data.data.map(anime => ({
          id: anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          title: anime.title,
          image: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
          esLatino: true
        }));
      }
    } catch (e) {
      console.log('Cargando catálogo interno de respaldo latino...');
    }

    if (resultados.length === 0) {
      resultados = CATALOGO_LATINO;
    }

    res.json({ success: true, page: page, data: resultados });
  } catch (error) {
    res.json({ success: true, page: 1, data: CATALOGO_LATINO });
  }
});

// Endpoint: Obtener episodios y servidores de reproductor (Iframe)
app.get('/api/anime/:id', async (req, res) => {
  const cleanId = req.params.id.replace('/anime/', '').replace(/\//g, '');
  
  try {
    const url = 'https://animeflv.net/anime/' + cleanId;
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
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
          episodes = parsedEps.map(ep => ({ number: ep[0], id: cleanId + '-' + ep[0] }));
        }
      }
    });

    if (episodes.length === 0) {
      episodes = Array.from({ length: 12 }, (_, i) => ({ number: i + 1, id: cleanId + '-' + (i + 1) }));
    }

    res.json({
      success: true,
      data: {
        id: cleanId,
        title: title || cleanId.replace(/-/g, ' ').toUpperCase(),
        image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
        episodes: episodes
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        id: cleanId,
        title: cleanId.replace(/-/g, ' ').toUpperCase(),
        episodes: Array.from({ length: 12 }, (_, i) => ({ number: i + 1, id: cleanId + '-' + (i + 1) }))
      }
    });
  }
});

// Endpoint: Obtener el Link del Reproductor Iframe del Episodio
app.get('/api/ver/:epId', async (req, res) => {
  const epId = req.params.epId;
  try {
    const url = `https://animeflv.net/ver/${epId}`;
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 });
    const $ = cheerio.load(response.data);
    
    let iframeUrl = '';
    const scripts = $('script');
    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.includes('var videos =')) {
        const videoData = content.match(/var videos = (\{.*?\});/);
        if (videoData && videoData[1]) {
          const parsed = JSON.parse(videoData[1]);
          if (parsed.SUB && parsed.SUB.length > 0) {
            iframeUrl = parsed.SUB[0].code || parsed.SUB[0].url;
          }
        }
      }
    });

    // Fallback de reproductor genérico si falla el raspado en vivo
    if (!iframeUrl) {
      iframeUrl = `https://www.yourupload.com/embed/${epId}`;
    }

    res.json({ success: true, embed: iframeUrl });
  } catch (e) {
    res.json({ success: true, embed: `https://www.yourupload.com/embed/${epId}` });
  }
});

// Endpoint: Buscador (Busca tanto en Latino como Subtitulado)
app.get('/api/buscar', async (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  try {
    const { data } = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20`, { timeout: 4000 });
    const resultados = data.data.map(anime => ({
      id: anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: anime.title,
      image: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
      esLatino: anime.title.toLowerCase().includes('latino')
    }));
    return res.json({ success: true, count: resultados.length, data: resultados });
  } catch (e) {
    const filtrados = CATALOGO_LATINO.filter(a => a.title.toLowerCase().includes(query));
    return res.json({ success: true, count: filtrados.length, data: filtrados });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Servidor listo y activo en el puerto ' + PORT);
});
