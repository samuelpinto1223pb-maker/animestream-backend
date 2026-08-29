const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// Servir automáticamente todos los archivos estáticos de la raíz (index.html, latino.json, etc.)
app.use(express.static(path.join(__dirname, './')));

// Ruta principal que entrega el archivo de la interfaz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta API por si quieres consultar los datos directamente
app.get('/api/anime', (req, res) => {
  res.sendFile(path.join(__dirname, 'latino.json'));
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
