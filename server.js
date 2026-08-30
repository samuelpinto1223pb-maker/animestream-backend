const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

// Servir estáticos
app.use(express.static(path.join(__dirname, './')));

// Buscar latino.json sin importar si está en mayúscula o minúscula
const getJsonPath = () => {
  const p1 = path.join(__dirname, 'latino.json');
  const p2 = path.join(__dirname, 'Latino.json');
  if (fs.existsSync(p1)) return p1;
  if (fs.existsSync(p2)) return p2;
  return null;
};

// Endpoint optimizado para entregar el archivo grande
app.get('/latino.json', (req, res) => {
  const jsonPath = getJsonPath();
  if (jsonPath) {
    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(jsonPath).pipe(res);
  } else {
    res.status(404).json({ error: "Archivo latino.json no encontrado" });
  }
});

// Alias API por compatibilidad
app.get('/api/anime', (req, res) => {
  const jsonPath = getJsonPath();
  if (jsonPath) {
    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(jsonPath).pipe(res);
  } else {
    res.status(404).json({ error: "Archivo latino.json no encontrado" });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
