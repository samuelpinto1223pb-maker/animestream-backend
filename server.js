const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, './')));

// Ruta para servir latino.json buscando en múltiples ubicaciones posibles
app.get('/latino.json', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'latino.json'),
    path.join(__dirname, '../latino.json'),
    path.join(__dirname, 'scripts', 'latino.json')
  ];

  for (let p of possiblePaths) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }

  // Respuesta de respaldo si el archivo aún se está creando
  res.json([]);
});

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("<h1>Servidor activo. Sube index.html a la raíz.</h1>");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
