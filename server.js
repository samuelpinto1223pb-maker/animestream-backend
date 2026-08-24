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

app.get('/api/animes', async (req, res) => {
  try {
    const { data } = await axios.get('https://animeflv.net', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const $ = cheerio.load(data);
    const animes = [];

    $('.ListEpisodios li, .ListAnimes li').each((index, element) => {
      const title = $(element).find('.Title, .Title strong').text().trim();
      const episode = $(element).find('.Capa, .Nro').text().trim();
      const image = $(element).find('img').attr('src');
      const url = $(element).find('a').attr('href');

      if (title) {
        animes.push({
          title: title,
          episode: episode || 'N/A',
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Servidor corriendo en el puerto ' + PORT);
});
