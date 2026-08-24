const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Array en memoria para tus animes propios subidos
const misAnimesPropios = [];

app.get('/', (req, res) => {
  res.send('Servidor de AnimeStream funcionando correctamente.');
});

// Función auxiliar para obtener múltiples páginas (page=1, page=2, page=3)
async function fetchMultipage(baseUrl, maxPages = 3) {
  const allResults = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9'
  };

  for (let page = 1; page <= maxPages; page++) {
    try {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const targetUrl = `${baseUrl}${separator}page=${page}`;
      
      const { data } = await axios.get(targetUrl, { timeout: 10000, headers });
      const $ = cheerio.load(data);
      let itemsFound = 0;

      $('ul.ListAnimes li').each((index, element) => {
        const title = $(element).find('h3.Title').text().trim() || $(element).find('.Title').first().text().trim();
        const image = $(element).find('img').attr('src');
        const url = $(element).find('a').attr('href');

        if (title) {
          allResults.push({
            title: title,
            image: image ? (image.startsWith('http') ? image : 'https://animeflv.net' + image) : null,
            url: url ? 'https://animeflv.net' + url : null
          });
          itemsFound++;
        }
      });

      if (itemsFound === 0) break;
    } catch (error) {
      console.error(`Error al obtener la página ${page}:`, error.message);
      break;
    }
  }

  return allResults;
}

// Endpoint 1: Todos los animes del catálogo (3 páginas combinadas)
app.get('/api/animes', async (req, res) => {
  try {
    const scrapedAnimes = await fetchMultipage('https://animeflv.net/browse', 3);
    const todosLosAnimes = [...misAnimesPropios, ...scrapedAnimes];

    res.json({ success: true, count: todosLosAnimes.length, data: todosLosAnimes });
  } catch (error) {
    console.error('Error detallado:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Buscar animes por nombre (3 páginas de búsqueda)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Debes proporcionar un término de búsqueda' });
  }

  try {
    const searchUrl = 'https://animeflv.net/browse?q=' + encodeURIComponent(query);
    const scrapedResults = await fetchMultipage(searchUrl, 3);

    const propiosFiltrados = misAnimesPropios.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
    const todosResultados = [...propiosFiltrados, ...scrapedResults];

    res.json({ success: true, count: todosResultados.length, data: todosResultados });
  } catch (error) {
    console.error('Error en búsqueda:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Animes en Español Latino (Búsqueda por palabras clave)
app.get('/api/latino', async (req, res) => {
  try {
    // Busca combinaciones comunes que AnimeFLV usa en sus títulos doblados
    const [resLatino, resAudio] = await Promise.all([
      fetchMultipage('https://animeflv.net/browse?q=latino', 2),
      fetchMultipage('https://animeflv.net/browse?q=audio+latino', 2)
    ]);

    // Combinar y eliminar duplicados por URL
    const combinados = [...resLatino, ...resAudio];
    const unicosMap = new Map();
    combinados.forEach(item => unicosMap.set(item.url, item));
    const scrapedLatino = Array.from(unicosMap.values());

    const animeLatinoTagged = scrapedLatino.map(anime => ({ ...anime, idioma: 'Español Latino' }));
    const propiosLatino = misAnimesPropios.filter(a => a.idioma === 'Español Latino');
    const todosLatino = [...propiosLatino, ...animeLatinoTagged];

    res.json({ success: true, count: todosLatino.length, data: todosLatino });
  } catch (error) {
    console.error('Error en latino:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Endpoint 4: Agregar tus propios animes personalizados
app.post('/api/animes/subir', (req, res) => {
  const { title, image, url, idioma } = req.body;
  if (!title || !url) {
    return res.status(400).json({ success: false, error: 'Debes incluir al menos un título y una URL de reproducción' });
  }

  const nuevoAnime = {
    id: Date.now(),
    title,
    image: image || 'https://via.placeholder.com/300x400?text=Sin+Imagen',
    url,
    idioma: idioma || 'Subtitulado',
    propio: true
  };

  misAnimesPropios.unshift(nuevoAnime);
  res.json({ success: true, message: 'Anime agregado correctamente a tu catálogo', data: nuevoAnime });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
    
