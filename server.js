const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Permite peticiones desde cualquier origen (soluciona el error de carga)
app.use(cors());

// Servir la página web (index.html) de la raíz
app.use(express.static(path.join(__dirname)));

// Endpoint API para enviar el archivo latino.json
app.get('/api/animes', (req, res) => {
  // Busca el archivo en la raíz del proyecto
  const jsonPath = path.join(__dirname, 'latino.json');

  if (fs.existsSync(jsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({ error: "El archivo latino.json aún no se ha generado." });
  }
});

// Ruta principal para cargar la interfaz web
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Backend de AnimeStream corriendo correctamente.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
