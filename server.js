const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor de AnimeStream funcionando correctamente.');
});

// Endpoint 1: Todos los animes del catálogo (General)
app.get('/api/animes', async (req, res) => {
  try {
    const { data } = await axios.get('https://animeflv.net/browse', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const $ = cheerio.load(data);
    const animes = [];

    $('ul.ListAnimes li').each((index, element) => {
      const title = $(element).find('h3.Title').text().trim() || $(element).find('.Title').first().text().trim();
      const image = $(element).find('img').attr('src');
      const url = $(element).find('a').attr('href');

      if (title) {
        animes.push({
          title: title,
          image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
          url: url ? 'https://animeflv.net' + url : null
        });
      }
    });

    res.json({ success: true, count: animes.length, data: animes });
  } catch (error) {
    console.error('Error detallado:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Buscar animes por nombre
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Debes proporcionar un término de búsqueda' });
  }

  try {
    const { data } = await axios.get('https://animeflv.net/browse?q=' + encodeURIComponent(query), {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('ul.ListAnimes li').each((i, el) => {
      const title = $(el).find('h3.Title').text().trim() || $(el).find('.Title').first().text().trim();
      const image = $(el).find('img').attr('src');
      const url = $(el).find('a').attr('href');

      if (title) {
        results.push({
          title: title,
          image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
          url: url ? 'https://animeflv.net' + url : null
        });
      }
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error en búsqueda:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Animes en Español Latino exclusivamente
app.get('/api/latino', async (req, res) => {
  try {
    const { data } = await axios.get('https://animeflv.net/browse?genre[]=latino&order=default', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('ul.ListAnimes li').each((i, el) => {
      const title = $(el).find('h3.Title').text().trim() || $(el).find('.Title').first().text().trim();
      const image = $(el).find('img').attr('src');
      const url = $(el).find('a').attr('href');

      if (title) {
        results.push({
          title: title,
          image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
          url: url ? 'https://animeflv.net' + url : null
        });
      }
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error en latino:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Servidor corriendo en el puerto ' + PORT);
});


