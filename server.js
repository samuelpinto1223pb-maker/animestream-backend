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
  usuariosActivos: 0
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

// EXTRAER REPRODUCTOR DE URL NINJA (MEJORADO)
app.post('/api/extraer-ninja', async (req, res) => {
  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL del episodio" });

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlNinja)}&timestamp=${Date.now()}`;
    const response = await axios.get(proxyUrl, { timeout: 15000 });
    const htmlData = response.data.contents;
    
    const $ = cheerio.load(htmlData);
    let streamUrl = null;

    // 1. Buscar en iframe
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('google')) {
        streamUrl = src;
        return false;
      }
    });

    // 2. Buscar en alternativas (embed / video)
    if (!streamUrl) {
      $('embed, video source').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
          streamUrl = src;
          return false;
        }
      });
    }

    if (!streamUrl) {
      return res.status(404).json({ error: "No se encontró un reproductor activo en este enlace." });
    }

    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;

    res.json({ success: true, streamUrl });
  } catch (error) {
    console.error("Error al extraer:", error.message);
    res.status(500).json({ error: "Error al conectar con la fuente." });
  }
});

// AGREGAR ANIME AL CATÁLOGO
app.post('/api/admin/agregar-anime', (req, res) => {
  let { titulo, imagen, urlNinja } = req.body;

  if (!urlNinja) {
    return res.status(400).json({ error: "Debes pegar al menos el enlace de Ninja" });
  }

  const nuevoAnime = {
    id: Date.now().toString(),
    titulo: titulo && titulo.trim() !== "" ? titulo : "Anime Guardado",
    imagen: imagen && imagen.trim() !== "" ? imagen : "https://picsum.photos/300/450",
    urlNinja: urlNinja.trim()
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
