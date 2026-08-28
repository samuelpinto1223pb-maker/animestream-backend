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

app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

app.get('/api/catalogo-guardado', (req, res) => {
  res.json({ success: true, animes: catalogoLocal });
});

// EXTRAER REPRODUCTOR (CONECTA DIRECTO O USA BACKUP)
app.post('/api/extraer-ninja', async (req, res) => {
  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL del episodio" });

  let htmlData = "";

  // Intentar conexión directa con User-Agent común
  try {
    const directRes = await axios.get(urlNinja, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    htmlData = directRes.data;
  } catch (e) {
    // Si falla directo, usar proxy secundario (codetabs) en lugar de allorigins
    try {
      const proxyRes = await axios.get(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(urlNinja)}`, { timeout: 8000 });
      htmlData = proxyRes.data;
    } catch (proxyError) {
      console.error("Fallaron ambas conexiones:", proxyError.message);
      return res.status(504).json({ error: "Servidor fuente lento o no disponible. Intenta de nuevo." });
    }
  }

  try {
    const $ = cheerio.load(htmlData);
    let streamUrl = null;

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src && !src.includes('facebook') && !src.includes('disqus') && !src.includes('google')) {
        streamUrl = src;
        return false;
      }
    });

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
      return res.status(404).json({ error: "No se encontró reproductor activo en esta URL." });
    }

    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;

    res.json({ success: true, streamUrl });
  } catch (error) {
    res.status(500).json({ error: "Error procesando el contenido." });
  }
});

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
