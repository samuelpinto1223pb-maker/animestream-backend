const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
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
}

// ESTADO SERVIDOR
app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

// OBTENER CATÁLOGO
app.get('/api/catalogo-guardado', (req, res) => {
  res.json({ success: true, animes: catalogoLocal });
});

// EXTRAER REPRODUCTOR DE URL NINJA (USANDO PROXY)
app.post('/api/extraer-ninja', async (req, res) => {
  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL del episodio" });

  try {
    // Uso de proxy público para evadir el bloqueo 403 de Cloudflare
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlNinja)}`;
    const response = await axios.get(proxyUrl, { timeout: 15000 });
    const htmlData = response.data.contents;
    
    const $ = cheerio.load(htmlData);
    let streamUrl = null;

    // Buscar iFrames válidos en la estructura
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus')) {
        streamUrl = src;
        return false;
      }
    });

    if (!streamUrl) {
      return res.status(404).json({ error: "No se encontró un reproductor activo en este episodio." });
    }

    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;

    res.json({ success: true, streamUrl });
  } catch (error) {
    console.error("Error al extraer:", error.message);
    res.status(500).json({ error: "Error al saltar el bloqueo de la fuente." });
  }
});

// AGREGAR ANIME AL CATÁLOGO
app.post('/api/admin/agregar-anime', (req, res) => {
  const { pass, titulo, imagen, urlNinja } = req.body;
  if (pass !== configServidor.claveAdmin) {
    return res.status(403).json({ error: "Clave incorrecta" });
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

  res.json({ success: true, mensaje: "Guardado correctamente", anime: nuevoAnime });
});

app.post('/api/liberar-cupo', (req, res) => {
  if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
  res.json({ activos: configServidor.usuariosActivos });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
