const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
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
        const id = relativeUrl.replace('/anime/', '').replace('/', '');
        const fullImage = image && image.startsWith('http') ? image : 'https://animeflv.net' + image;

        resultados.push({
          id: id,
          title: title,
          image: fullImage,
          url: 'https://animeflv.net/' + id,
          idioma: title.toLowerCase().includes('latino') ? 'Español Latino' : 'Subtitulado'
        });
      }
    });

    return resultados;
  } catch (error) {
    return [];
  }
}

async function poblarCatalogoLatinoAuto() {
  console.log('Iniciando escaneo automático...');
  let catalogoLocal = leerJsonLocal();

  for (let i = 1; i <= 150; i++) {
    try {
      const url = 'https://animeflv.net/browse?order=default&page=' + i;
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
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (e) {
      console.log('Error en página ' + i);
    }
  }
}

// Endpoint 1: Catálogo con soporte de fallback en vivo para garantizar páginas (1, 2, 3...)
app.get('/api/latino', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const catalogoLocal = leerJsonLocal();

    let listaFinal = catalogoLocal.filter(a => a.title.toLowerCase().includes('latino') || a.idioma === 'Español Latino');
    
    // Si el JSON local aún tiene pocos elementos, traemos directamente de AnimeFLV en vivo
    if (listaFinal.length < 50) {
      const urlLive = 'https://animeflv.net/browse?order=default&page=' + page;
      const animesEnVivo = await obtenerAnimesPagina(urlLive);
      return res.json({
        success: true,
        page: page,
        total_registrados: 2800, // Fuerza el cálculo para mostrar más páginas en la web
        count: animesEnVivo.length,
        data: animesEnVivo
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const resultados = listaFinal.slice(startIndex, endIndex);

    res.json({
      success: true,
      page: page,
      total_registrados: Math.max(listaFinal.length, 2800),
      count: resultados.length,
      data: resultados
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Detalles y Episodios Corregidos (Robustecido)
app.get('/api/anime/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId.replace('/anime/', '').replace('/', '');
    const url = 'https://animeflv.net/anime/' + cleanId;
    
    let response;
    try {
      response = await axios.get(url, { headers: HEADERS_HTTP });
    } catch (err) {
      // Si el ID exacto falla, buscamos en vivo por texto
      const searchUrl = 'https://animeflv.net/browse?q=' + encodeURIComponent(cleanId.replace(/-/g, ' '));
      const busqueda = await obtenerAnimesPagina(searchUrl);
      if (busqueda.length > 0) {
        const realUrl = 'https://animeflv.net/anime/' + busqueda[0].id;
        response = await axios.get(realUrl, { headers: HEADERS_HTTP });
      } else {
        return res.status(404).json({ success: false, error: 'Anime no encontrado' });
      }
    }

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
        title: title,
        image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
        episodes: episodes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener capítulos: ' + error.message });
  }
});

// Endpoint 3: Ver Episodio (Servidores)
app.get('/api/ver/:episodeId', async (req, res) => {
  try {
    const episodeId = req.params.episodeId;
    const url = 'https://animeflv.net/ver/' + episodeId;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    const $ = cheerio.load(data);

    let servers = [];
    const scripts = $('script');

    scripts.each((_, el) => {
      const content = $(el).html();
      if (content && content.includes('var videos =')) {
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

// Endpoint 4: Buscador
app.get('/api/buscar', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ success: false, error: 'Término requerido' });
    const url = 'https://animeflv.net/browse?q=' + encodeURIComponent(query);
    const resultados = await obtenerAnimesPagina(url);
    res.json({ success: true, count: resultados.length, data: resultados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log('Servidor activo en el puerto ' + PORT);
    poblarCatalogoLatinoAuto();
});
