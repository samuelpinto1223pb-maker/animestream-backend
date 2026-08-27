const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Permitir peticiones desde cualquier origen (Evita bloqueos de CORS en el navegador)
app.use(cors({ origin: '*' }));
app.use(express.json());

const HEADERS_HTTP = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

const JSON_PATH = path.join(__dirname, 'latino.json');

function leerJsonLocal() {
  try {
    if (fs.existsSync(JSON_PATH)) {
      const data = fs.readFileSync(JSON_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error al leer latino.json:', error);
  }
  return [];
}

function guardarJsonLocal(listaActualizada) {
  try {
    fs.writeFileSync(JSON_PATH, JSON.stringify(listaActualizada, null, 2), 'utf-8');
    console.log('¡Base de datos guardada! Total animes: ' + listaActualizada.length);
  } catch (error) {
    console.error('Error al escribir en latino.json:', error);
  }
}

async function obtenerAnimesPagina(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);
    let resultados = [];

    $('article.Anime, .ListAnimes li').each((_, element) => {
      const title = $(element).find('.Title').text().trim();
      const image = $(element).find('img').attr('src');
      const relativeUrl = $(element).find('a').attr('href');

      if (title && relativeUrl) {
        const id = relativeUrl.replace('/anime/', '');
        const fullImage = (image && image.indexOf('http') === 0) ? image : 'https://animeflv.net' + image;

        resultados.push({
          id: id,
          title: title,
          image: fullImage,
          url: 'https://animeflv.net' + relativeUrl,
          idioma: 'Español Latino'
        });
      }
    });

    return resultados;
  } catch (error) {
    return [];
  }
}

async function poblarCatalogoLatinoAuto() {
  console.log('Iniciando escaneo automático programado...');
  let catalogoLocal = leerJsonLocal();

  for (let i = 1; i <= 45; i++) {
    try {
      const url = 'https://animeflv.net/browse?type%5B%5D=tv&order=default&page=' + i;
      const animesPagina = await obtenerAnimesPagina(url);

      let huboNuevos = false;
      animesPagina.forEach(animeNuevo => {
        const existe = catalogoLocal.some(item => item.id === animeNuevo.id);
        if (!existe) {
          catalogoLocal.push(animeNuevo);
          huboNuevos = true;
        }
      });

      if (huboNuevos) {
        guardarJsonLocal(catalogoLocal);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('Error en página ' + i + ', continuando...');
    }
  }
  console.log('¡Escaneo masivo completado con éxito!');
}

// Endpoint 1: Catálogo Latino
app.get('/api/latino', (req, res) => {
  try {
    const catalogoLocal = leerJsonLocal();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const resultados = catalogoLocal.slice(startIndex, endIndex);

    res.json({
      success: true,
      page: page,
      total_registrados: catalogoLocal.length,
      count: resultados.length,
      data: resultados
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Catálogo General
app.get('/api/animes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = 'https://animeflv.net/browse?page=' + page;
    const animes = await obtenerAnimesPagina(url);
    res.json({ success: true, page: Number(page), count: animes.length, data: animes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Detalles del Anime
app.get('/api/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const url = 'https://animeflv.net/anime/' + animeId;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    const title = $('.section-body .Title').text().trim();
    const sinopsis = $('.Plot').text().trim();
    const image = $('.AnimeCover .Image img').attr('src');

    const scripts = $('script');
    let episodes = [];
    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.indexOf('var episodes =') !== -1) {
        const epData = content.match(/var episodes = (\[\[.*?\]\]);/);
        if (epData && epData[1]) {
          const parsedEps = JSON.parse(epData[1]);
          episodes = parsedEps.map(ep => ({
            number: ep[0],
            id: animeId + '-' + ep[0]
          }));
        }
      }
    });

    res.json({
      success: true,
      data: {
        id: animeId,
        title: title,
        sinopsis: sinopsis,
        image: image ? 'https://animeflv.net' + image : null,
        episodes: episodes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 4: Servidores de Video
app.get('/api/ver/:episodeId', async (req, res) => {
  try {
    const episodeId = req.params.episodeId;
    const url = 'https://animeflv.net/ver/' + episodeId;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    const scripts = $('script');
    let servers = [];

    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.indexOf('var videos =') !== -1) {
        const videoData = content.match(/var videos = (\{.*?\});/);
        if (videoData && videoData[1]) {
          const parsed = JSON.parse(videoData[1]);
          servers = parsed.SUB || parsed.LAT || [];
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto ' + PORT);
    
    // Escaneo automático programado cada 24 horas
    const veinticuatroHoras = 24 * 60 * 60 * 1000;
    setInterval(async () => {
        await poblarCatalogoLatinoAuto();
    }, veinticuatroHoras);
});
      
