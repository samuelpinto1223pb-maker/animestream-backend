const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DEL SERVIDOR
let configServidor = {
  limiteUsuarios: 10,
  usuariosActivos: 0,
  claveAdmin: "admin2026"
};

const ARCHIVO_CATALOGO = path.join(__dirname, 'catalogo.json');

// Cargar catálogo guardado o iniciar con lista base
let catalogoLocal = [];
if (fs.existsSync(ARCHIVO_CATALOGO)) {
  try {
    catalogoLocal = JSON.parse(fs.readFileSync(ARCHIVO_CATALOGO, 'utf-8'));
  } catch (e) {
    catalogoLocal = [];
  }
} else {
  catalogoLocal = [
    {
      id: "1",
      titulo: "Naruto Latino Cap 1",
      imagen: "https://i.imgur.com/8N69FhL.jpg",
      urlNinja: "https://ww3.animeonline.ninja/episodio/naruto-latino-cap-1/"
    }
  ];
  fs.writeFileSync(ARCHIVO_CATALOGO, JSON.stringify(catalogoLocal, null, 2));
}

const HEADERS_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://ww3.animeonline.ninja/'
};

// 1. ESTADO DEL SERVIDOR
app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

// 2. OBTENER CATÁLOGO GUARDADO
app.get('/api/catalogo-guardado', (req, res) => {
  res.json({ success: true, animes: catalogoLocal });
});

// 3. AGREGAR ANIME AL CATÁLOGO (Solo Admin)
app.post('/api/admin/agregar-anime', (req, res) => {
  const { pass, titulo, imagen, urlNinja } = req.body;
  if (pass !== configServidor.claveAdmin) {
    return res.status(403).json({ error: "Clave de administración incorrecta" });
  }

  if (!titulo || !imagen || !urlNinja) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const nuevoAnime = {
    id: Date.now().toString(),
    titulo,
    imagen,
    urlNinja
  };

  catalogoLocal.unshift(nuevoAnime);
  fs.writeFileSync(ARCHIVO_CATALOGO, JSON.stringify(catalogoLocal, null, 2));

  res.json({ success: true, mensaje: "Anime guardado exitosamente", anime: nuevoAnime });
});

// 4. ELIMINAR ANIME DEL CATÁLOGO (Solo Admin)
app.post('/api/admin/eliminar-anime', (req, res) => {
  const { pass, id } = req.body;
  if (pass !== configServidor.claveAdmin) {
    return res.status(403).json({ error: "Clave incorrecta" });
  }

  catalogoLocal = catalogoLocal.filter(item => item.id !== id);
  fs.writeFileSync(ARCHIVO_CATALOGO, JSON.stringify(catalogoLocal, null, 2));

  res.json({ success: true, mensaje: "Anime eliminado del catálogo" });
});

// 5. EXTRAER VIDEO DE FUENTE NINJA
app.post('/api/extraer-ninja', async (req, res) => {
  if (configServidor.usuariosActivos >= configServidor.limiteUsuarios) {
    return res.status(429).json({ error: "Servidor Lleno", saturado: true });
  }

  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL" });

  configServidor.usuariosActivos++;

  try {
    const response = await axios.get(urlNinja, { headers: HEADERS_NAVEGADOR, timeout: 15000 });
    const $ = cheerio.load(response.data);
    let streamUrl = null;

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus')) {
        streamUrl = src;
        return false;
      }
    });

    if (!streamUrl) {
      if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
      return res.status(404).json({ error: "No se encontró un reproductor en esa URL." });
    }

    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;

    res.json({ success: true, streamUrl });
  } catch (error) {
    if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
    res.status(500).json({ error: "Error al obtener el reproductor de la fuente." });
  }
});

// 6. LIBERAR CUPO
app.post('/api/liberar-cupo', (req, res) => {
  if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
  res.json({ activos: configServidor.usuariosActivos });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
