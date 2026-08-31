const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Habilitar CORS para permitir peticiones desde cualquier página o celular
app.use(cors());

// Función auxiliar para leer el archivo latino.json
const getAnimeData = () => {
  const filePath = path.join(__dirname, 'latino.json');
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  }
  return [];
};

// Ruta principal de la API
app.get('/api/anime', (req, res) => {
  try {
    const data = getAnimeData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer la base de datos de anime' });
  }
});

// Ruta raíz de respaldo (por si entras directo a la URL base)
app.get('/', (req, res) => {
  try {
    const data = getAnimeData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer la base de datos de anime' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
