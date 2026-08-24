const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Ruta principal de comprobación
app.get('/', (req, res) => {
  res.send('Servidor de AnimeStream funcionando correctamente.');
});

// Ruta para obtener los últimos animes / episodios
app.get('/api/animes', async (req, res) => {
  try {
    // Ejemplo haciendo scraping a la fuente de animes
    const { data } = await axios.get('https://www.animeflv.net', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const animes = [];

    // Extrae los elementos de la lista de episodios recientes
    $('.ListEpisodios li').each((index, element) => {
      const title = $(element).find('.Title').text().trim();
      const episode = $(element).find('.Capa').text().trim();
      const image = $(element).find('img').attr('src');
      const url = $(element).find('a').attr('href');

      if (title) {
        animes.push({
          title,
          episode,
          image: image ? `https://www.animeflv.net${image}` : null,
          url: url ? `https://www.animeflv.net${url}` : null
        });
      }
    });

    res.json({ success: true, count: animes.length, data: animes });
  } catch (error) {
    console.error('Error al obtener animes:', error.message);
    res.status(500).json({ success: false, error: 'No se pudieron extraer los animes' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
