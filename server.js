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

// Scraper 1: AnimeFLV (Catálogo General / Búsquedas)
async function fetchAnimeFLV(baseUrl, maxPages = 3) {
  let allResults = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;
      const { data } = await axios.get(url, { headers: HEADERS_HTTP });
      const $ = cheerio.load(data);
      let itemsFound = 0;

      $('.ListAnimes li, article.Anime').each((_, element) => {
        const title = $(element).find('.Title').text().trim();
        const image = $(element).find('img').attr('src');
        const relativeUrl = $(element).find('a').attr('href');

        if (title && relativeUrl) {
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://animeflv.net${relativeUrl}`;
          const fullImage = image && image.startsWith('http') ? image : `https://animeflv.net${image}`;
          allResults.push({ title, image: fullImage, url: fullUrl, idioma: 'Subtitulado' });
          itemsFound++;
        }
      });

      if (itemsFound === 0) break;
    } catch (error) {
      console.error(`Error scraping AnimeFLV pág ${page}:`, error.message);
      break;
    }
  }
  return allResults;
}

// Scraper 2: JKAnime (Sección especializada en Latino)
async function fetchJKAnimeLatino(maxPages = 2) {
  let results = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://jkanime.net/buscar/latino/${page}/`;
      const { data } = await axios.get(url, { headers: HEADERS_HTTP });
      const $ = cheerio.load(data);

      $('.anime__item, .bloque5').each((_, element) => {
        const title = $(element).find('h5, .title, a').first().text().trim();
        const image = $(element).find('.anime__item__pic, img').attr('data-setbg') || $(element).find('img').attr('src');
        const relativeUrl = $(element).find('a').attr('href');

        if (title && relativeUrl) {
          results.push({
            title: title.includes('Latino') ? title : `${title} (Latino)`,
            image: image || 'https://via.placeholder.com/308x400?text=Sin+Imagen',
            url: relativeUrl,
            idioma: 'Español Latino'
          });
        }
      });
    } catch (error) {
      console.error(`Error scraping JKAnime pág ${page}:`, error.message);
      break;
    }
  }
  return results;
}

// Endpoint 1: Catálogo General (Todos los animes)
app.get('/api/animes', async (req, res) => {
  try {
    const todosLosAnimes = await fetchAnimeFLV('https://animeflv.net/browse', 4);
    res.json({ success: true, count: todosLosAnimes.length, data: todosLosAnimes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2: Buscar animes por nombre
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ success: false, error: 'Debes proporcionar un término de búsqueda' });

  try {
    const searchUrl = `https://animeflv.net/browse?q=${encodeURIComponent(query)}`;
    const resultados = await fetchAnimeFLV(searchUrl, 3);
    res.json({ success: true, count: resultados.length, data: resultados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 3: Catálogo Multifuente en Español Latino (Lista base + Scraping AnimeFLV + Scraping JKAnime)
app.get('/api/latino', async (req, res) => {
  try {
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

    // Ejecuta las búsquedas externas de forma en paralelo para ahorrar tiempo de espera
    const [scrapedFLV, scrapedJK] = await Promise.all([
      fetchAnimeFLV('https://animeflv.net/browse?q=latino', 3),
      fetchJKAnimeLatino(2)
    ]);

    const flvTagged = scrapedFLV.map(anime => ({ ...anime, idioma: 'Español Latino' }));
    const todosAnimes = [...listaLatinoBase, ...flvTagged, ...scrapedJK];

    // Eliminar duplicados por URL o por Título
    const unicosMap = new Map();
    todosAnimes.forEach(item => {
      const claveUnica = item.title.toLowerCase().trim();
      if (!unicosMap.has(claveUnica)) unicosMap.set(claveUnica, item);
    });

    const resultadoFinal = Array.from(unicosMap.values());
    res.json({ success: true, count: resultadoFinal.length, data: resultadoFinal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
    
