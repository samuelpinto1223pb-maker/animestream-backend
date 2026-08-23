const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor de AnimeStream funcionando correctamente.');
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q || 'Naruto';
  try {
    const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12`);
    const results = response.data.data.map(item => ({
      id: item.mal_id,
      title: item.title,
      cover: item.images.jpg.image_url,
      embed: item.trailer?.embed_url || ''
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener animes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
