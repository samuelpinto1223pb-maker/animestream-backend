const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

let configServidor = {
  limiteUsuarios: 10,
  usuariosActivos: 0,
  claveAdmin: "admin2026"
};

const ARCHIVO_CATALOGO = path.join(__dirname, 'catalogo.json');

let catalogoLocal = [];
if (fs.existsSync(ARCHIVO_CATALOGO)) {
  try {
    catalogoLocal = JSON.parse(fs.readFileSync(ARCHIVO_CATALOGO, 'utf-8'));
  } catch (e) {
    catalogoLocal = [];
  }
} else {
  catalogoLocal = [];
  fs.writeFileSync(ARCHIVO_CATALOGO, JSON.stringify(catalogoLocal, null, 2));
}

// Estado del servidor
app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

// Obtener catálogo guardado
app.get('/api/catalogo-guardado', (req, res) => {
  res.json({ success: true, animes: catalogoLocal });
});

// Agregar nuevo anime
app.post('/api/admin/agregar-anime', (req, res) => {
  const { pass, titulo, imagen, embedUrl } = req.body;
  if (pass !== configServidor.claveAdmin) {
    return res.status(403).json({ error: "Clave incorrecta" });
  }

  if (!titulo || !imagen || !embedUrl) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const nuevoAnime = {
    id: Date.now().toString(),
    titulo,
    imagen,
    embedUrl
  };

  catalogoLocal.unshift(nuevoAnime);
  fs.writeFileSync(ARCHIVO_CATALOGO, JSON.stringify(catalogoLocal, null, 2));

  res.json({ success: true, mensaje: "Anime guardado con éxito", anime: nuevoAnime });
});

// Liberar cupo
app.post('/api/liberar-cupo', (req, res) => {
  if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
  res.json({ activos: configServidor.usuariosActivos });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
