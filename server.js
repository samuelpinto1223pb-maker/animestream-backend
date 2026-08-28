const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// 1. Ruta para obtener el catálogo principal de animes
app.get('/api/animes', async (req, res) => {
  const page = req.query.page || 1;
  try {
    const response = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}`);
    const data = await response.json();
    res.json(data.data);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la lista de animes" });
  }
});

// 2. Ruta para obtener la información de un anime específico cuando le den clic
app.get('/api/anime/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`);
    const data = await response.json();
    res.json(data.data);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener detalles del anime" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en el puerto " + PORT));
