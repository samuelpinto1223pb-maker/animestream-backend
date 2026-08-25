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

// Endpoint 1: Catálogo Exclusivo Latino (JKAnime)
app.get('/api/latino', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://jkanime.net/latino/${page}/`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    let resultados = [];

    $('.anime__item').each((_, element) => {
      const title = $(element).find('.anime__item__text h5 a').text().trim();
      const relativeUrl = $(element).find('.anime__item__text h5 a').attr('href');
      const image = $(element).find('.anime__item__pic').attr('data-setbg');

      if (title && relativeUrl) {
        const id = relativeUrl.replace('https://jkanime.net/', '').replace('/', '');
        resultados.push({
          id,
          title,
          image: image || null,
          url: relativeUrl,
          idioma: 'Español Latino'
        });
      }
    });

    res.json({
      success: true,
      fuente: 'JKAnime',
      page: Number(page),
      count: resultados.length,
      data: resultados
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Catálogo General (AnimeFLV)
app.get('/api/animes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://animeflv.net/browse?page=${page}`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    let results = [];

    $('article.Anime, .ListAnimes li').each((_, element) => {
      const title = $(element).find('.Title').text().trim();
      const image = $(element).find('img').attr('src');
      const relativeUrl = $(element).find('a').attr('href');

      if (title && relativeUrl) {
        const id = relativeUrl.replace('/anime/', '');
        results.push({
          id,
          title,
          image: image && image.startsWith('http') ? image : `https://animeflv.net${image}`,
          url: `https://animeflv.net${relativeUrl}`
        });
      }
    });

    res.json({ success: true, page: Number(page), count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Detalles del Anime Latino
app.get('/api/latino/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const url = `https://jkanime.net/${animeId}/`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    const title = $('.anime__details__title h3').text().trim();
    const sinopsis = $('.anime__details__text p').text().trim();
    const image = $('.anime__details__pic').attr('data-setbg');

    res.json({
      success: true,
      data: {
        id: animeId,
        title,
        sinopsis,
        image: image || null,
        idioma: 'Español Latino'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
                                            
