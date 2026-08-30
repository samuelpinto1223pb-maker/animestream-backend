const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, './')));

// Ruta principal provisional para verificar que el backend funciona
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 20px; text-align: center;">
      <h1>🚀 Backend de AnimeStream Activo</h1>
      <p>Servidor corriendo correctamente sin depender de index.html.</p>
      <p>Prueba el catálogo directamente en: <a href="/latino.json" target="_blank">/latino.json</a></p>
    </div>
  `);
});

// Endpoint streaming optimizado para entregar los 6.75 MB de latino.json
app.get('/latino.json', (req, res) => {
  const p1 = path.join(__dirname, 'latino.json');
  const p2 = path.join(__dirname, 'Latino.json');
  const jsonPath = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);

  if (jsonPath) {
    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(jsonPath).pipe(res);
  } else {
    res.status(404).json({ error: 'Archivo latino.json no encontrado en el servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de AnimeStream corriendo en el puerto ${PORT}`);
});
