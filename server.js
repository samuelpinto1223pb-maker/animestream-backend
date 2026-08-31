const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Habilitar CORS para permitir peticiones desde cualquier cliente (Acode, localhost, etc.)
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del directorio raíz
app.use(express.static(path.join(__dirname)));

// Endpoint principal para obtener el catálogo completo de animes
app.get('/latino.json', (req, res) => {
  const filePath = path.join(__dirname, 'latino.json');
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'El archivo latino.json aún no se ha generado.' });
  }
});

// Endpoint alternativo tipo API
app.get('/api/animes', (req, res) => {
  const filePath = path.join(__dirname, 'latino.json');
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'El archivo latino.json aún no se ha generado.' });
  }
});

// Ruta raíz de prueba
app.get('/', (req, res) => {
  res.send('Servidor de AnimeStream corriendo correctamente 🚀');
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
