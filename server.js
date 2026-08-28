const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// Ruta para obtener animes paginados desde la API oficial
app.get('/api/animes', async (req, res) => {
  const page = req.query.page || 1; // Recibe la página actual (1, 2, 3...)
  try {
    const response = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}`);
    const data = await response.json();
    
    // Devuelve los 25 animes de esa página
    res.json(data.data);
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con la base de datos de animes" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor activo en el puerto " + PORT));
