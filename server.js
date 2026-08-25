const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const HEADERS_HTTP = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

async function obtenerAnimesPagina(url) {
  try {
    const { data } = await axios.get(url, {
      headers: HEADERS_HTTP
    });
    const $ = cheerio.load(data);
    let resultados = [];

    $('article.Anime, .ListAnimes li').each(
      (_, element) => {
        const title = $(element)
          .find('.Title')
          .text()
          .trim();
        const image = $(element)
          .find('img')
          .attr('src');
        const relativeUrl = $(element)
          .find('a')
          .attr('href');

        if (title && relativeUrl) {
          const id = relativeUrl.replace(
            '/anime/',
            ''
          );
          const fullImage =
            image && image.startsWith('http')
              ? image
              : `https://animeflv.net${image}`;

          resultados.push({
            id,
            title,
            image: fullImage,
            url: `https://animeflv.net${relativeUrl}`
          });
        }
      }
    );

    return resultados;
  } catch (error) {
    return [];
  }
}

// Endpoint 1: Catálogo Latino Paginado (Recorre todas las páginas)
app.get('/api/latino', async (req, res) => {
  try {
    const page = req.query.page || 1;
    // Escanea de a 3 páginas por consulta para no saturar la red
    const pInicio = (Number(page) - 1) * 3 + 1;
    
    const [b1, b2, b3] = await Promise.all([
      obtenerAnimesPagina(`https://animeflv.net/browse?q=latino&page=${pInicio}`),
      obtenerAnimesPagina(`https://animeflv.net/browse?q=latino&page=${pInicio + 1}`),
      obtenerAnimesPagina(`https://animeflv.net/browse?q=latino&page=${pInicio + 2}`)
    ]);

    const combinados = [...b1, ...b2, ...b3];
    const mapaUnico = new Map();

    combinados.forEach((item) => {
      item.idioma = 'Español Latino';
      mapaUnico.set(item.id, item);
    });

    const listaFinal = Array.from(mapaUnico.values());

    res.json({
      success: true,
      page: Number(page),
      count: listaFinal.length,
      data: listaFinal
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error.message });
  }
});

// Endpoint 2: Catálogo General
app.get('/api/animes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://animeflv.net/browse?page=${page}`;
    const animes = await obtenerAnimesPagina(url);
    res.json({
      success: true,
      page: Number(page),
      count: animes.length,
      data: animes
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error.message });
  }
});

// Endpoint 3: Detalles del Anime
app.get('/api/anime/:id', async (req, res) => {
  try {
    const animeId = req.params.id;
    const url = `https://animeflv.net/anime/${animeId}`;
    const { data } = await axios.get(url, {
      headers: HEADERS_HTTP
    });
    const $ = cheerio.load(data);

    const title = $('.section-body .Title')
      .text()
      .trim();
    const sinopsis = $('.Plot').text().trim();
    const image = $('.AnimeCover .Image img').attr(
      'src'
    );

    res.json({
      success: true,
      data: {
        id: animeId,
        title,
        sinopsis,
        image: image
          ? `https://animeflv.net${image}`
          : null
      }
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Servidor en puerto ${PORT}`)
);
