const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Permitir acceso desde cualquier origen (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Ruta de la API para entregar animes y reproductores
app.get('/api/anime/latino', (req, res) => {
  const jsonPath = path.join(__dirname, 'latino.json');
  
  if (fs.existsSync(jsonPath)) {
    const data = fs.readFileSync(jsonPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    return res.send(data);
  } else {
    return res.status(404).json({ error: 'El archivo latino.json aún no existe.' });
  }
});

// Ruta base
app.get('/', (req, res) => {
  res.send('Servidor backend de AnimeStream activo.');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
