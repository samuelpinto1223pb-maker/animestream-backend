const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración manual de CORS sin dependencias externas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Función para leer el archivo latino.json
const getAnimeData = () => {
  const filePath = path.join(__dirname, 'latino.json');
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  }
  return [];
};

// Rutas de la API
app.get('/api/anime', (req, res) => {
  res.json(getAnimeData());
});

app.get('/', (req, res) => {
  res.json(getAnimeData());
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
