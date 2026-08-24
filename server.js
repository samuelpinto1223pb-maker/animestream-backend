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

 // Endpoint 3: Animes en Español Latino (Catálogo estático + scraping)
app.get('/api/latino', async (req, res) => {
  try {
    // Lista base con títulos conocidos en Español Latino en AnimeFLV
    const listaLatinoBase = [
      { title: "Dragon Ball Super Latino", image: "https://animeflv.net/uploads/animes/covers/2793.jpg", url: "https://animeflv.net/anime/dragon-ball-super-latino", idioma: "Español Latino" },
      { title: "Naruto Latino", image: "https://animeflv.net/uploads/animes/covers/84.jpg", url: "https://animeflv.net/anime/naruto-latino", idioma: "Español Latino" },
      { title: "Bleach Latino", image: "https://animeflv.net/uploads/animes/covers/268.jpg", url: "https://animeflv.net/anime/bleach-latino", idioma: "Español Latino" },
      { title: "Death Note Latino", image: "https://animeflv.net/uploads/animes/covers/309.jpg", url: "https://animeflv.net/anime/death-note-latino", idioma: "Español Latino" },
      { title: "One Piece Latino", image: "https://animeflv.net/uploads/animes/covers/1.jpg", url: "https://animeflv.net/anime/one-piece-latino", idioma: "Español Latino" },
      { title: "Demon Slayer (Kimetsu no Yaiba) Latino", image: "https://animeflv.net/uploads/animes/covers/3105.jpg", url: "https://animeflv.net/anime/kimetsu-no-yaiba-latino", idioma: "Español Latino" },
      { title: "My Hero Academia Latino", image: "https://animeflv.net/uploads/animes/covers/2470.jpg", url: "https://animeflv.net/anime/boku-no-hero-academia-latino", idioma: "Español Latino" },
      { title: "Attack on Titan (Shingeki no Kyojin) Latino", image: "https://animeflv.net/uploads/animes/covers/1070.jpg", url: "https://animeflv.net/anime/shingeki-no-kyojin-latino", idioma: "Español Latino" },
      { title: "Jujutsu Kaisen Latino", image: "https://animeflv.net/uploads/animes/covers/3358.jpg", url: "https://animeflv.net/anime/jujutsu-kaisen-tv-latino", idioma: "Español Latino" },
      { title: "Tokyo Ghoul Latino", image: "https://animeflv.net/uploads/animes/covers/1297.jpg", url: "https://animeflv.net/anime/tokyo-ghoul-latino", idioma: "Español Latino" }
    ];

    const scrapedLatino = await fetchMultipage('https://animeflv.net/browse?q=latino', 1);
    const animeLatinoTagged = scrapedLatino.map(anime => ({ ...anime, idioma: 'Español Latino' }));

    // Combinar lista base, propios y scraped eliminando duplicados por URL
    const todos = [...listaLatinoBase, ...misAnimesPropios.filter(a => a.idioma === 'Español Latino'), ...animeLatinoTagged];
    const unicosMap = new Map();
    todos.forEach(item => unicosMap.set(item.url, item));
    const resultadoFinal = Array.from(unicosMap.values());

    res.json({ success: true, count: resultadoFinal.length, data: resultadoFinal });
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
    
