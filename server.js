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
      return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Error al leer latino.json:', error);
  }
  return [];
}

function guardarJsonLocal(listaActualizada) {
  try {
    fs.writeFileSync(JSON_PATH, JSON.stringify(listaActualizada, null, 2), 'utf-8');
    console.log(`¡Base de datos actualizada! Total animes: ${listaActualizada.length}`);
  } catch (error) {
    console.error('Error al escribir en latino.json:', error);
  }
}

// Extraer animes de la lista principal
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
        const fullImage = image && image.startsWith('http') ? image : `https://animeflv.net${image}`;

        resultados.push({
          id,
          title,
          image: fullImage,
          url: `https://animeflv.net${relativeUrl}`,
          idioma: 'Español Latino'
        });
      }
    });

    return resultados;
  } catch (error) {
    return [];
  }
}

// Extraer los reproductores de un episodio específico
async function obtenerVideosEpisodio(idAnime, numeroEpisodio) {
  try {
    const url = `https://animeflv.net/ver/${idAnime}-${numeroEpisodio}`;
    const { data } = await axios.get(url, { headers: HEADERS_HTTP });
    
    // Buscar el script donde AnimeFLV guarda las variables de los videos
    const match = data.match(/var videos = (\{.*?\});/);
    if (match && match[1]) {
      const videosData = JSON.parse(match[1]);
      // Extraer los embeds principales (SUB/LATINO)
      const servidores = videosData.SUB || videosData.LAT || [];
      return servidores.map(s => ({
        server: s.server,
        title: s.title,
        code: s.code // URL iframe/embed
      }));
    }
  } catch (error) {
    console.error(`Error al extraer episodio ${numeroEpisodio} de ${idAnime}`);
  }
  return [];
}

// Escaneo masivo automático
async function poblarCatalogoLatinoAuto() {
  console.log('Iniciando escaneo automático de catálogo...');
  let catalogoLocal = leerJsonLocal();

  for (let i = 1; i <= 5; i++) { // Cambia el rango de páginas a escanear según necesites
    try {
      const url = `https://animeflv.net/browse?type%5B%5D=tv&order=default&page=${i}`;
      const animesPagina = await obtenerAnimesPagina(url);

      for (let animeNuevo of animesPagina) {
        const existe = catalogoLocal.some(item => item.id === animeNuevo.id);
        if (!existe) {
          catalogoLocal.push(animeNuevo);
          guardarJsonLocal(catalogoLocal);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log(`Error en página ${i}, continuando...`);
    }
  }
  console.log('¡Escaneo de catálogo completado!');
}

// Endpoint 1: Obtener catálogo completo guardado
app.get('/api/latino', (req, res) => {
  const catalogoLocal = leerJsonLocal();
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const startIndex = (page - 1) * limit;
  const resultados = catalogoLocal.slice(startIndex, startIndex + limit);

  res.json({
    success: true,
    page,
    total_registrados: catalogoLocal.length,
    count: resultados.length,
    data: resultados
  });
});

// Endpoint 2: Obtener los reproductores de un capítulo en tiempo real
app.get('/api/ver/:id/:episodio', async (req, res) => {
  const { id, episodio } = req.params;
  const videos = await obtenerVideosEpisodio(id, episodio);

  if (videos.length > 0) {
    res.json({ success: true, id, episodio, servers: videos });
  } else {
    res.status(404).json({ success: false, message: 'No se encontraron reproductores para este episodio.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  await poblarCatalogoLatinoAuto();
});
