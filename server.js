const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// Servir archivos estáticos (index.html, latino.json, imágenes, etc.)
app.use(express.static(path.join(__dirname, './')));

// Ruta principal para cargar la web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta API para obtener los datos si se requieren directamente
app.get('/api/anime', (req, res) => {
  res.sendFile(path.join(__dirname, 'latino.json'));
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
