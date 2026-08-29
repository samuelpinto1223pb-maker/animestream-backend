

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const STREAMHG_API_KEY = '33163f7onx0vuadkojncs';

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

// EXTRAER Y ENVIAR A STREAMHG
app.post('/api/extraer-ninja', async (req, res) => {
  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL del episodio" });

  // Si ya es un enlace de StreamHG directo
  if (urlNinja.includes('streamhg.com/')) {
    let streamUrl = urlNinja.trim();
    if (!streamUrl.includes('/e/')) {
      streamUrl = streamUrl.replace('streamhg.com/', 'streamhg.com/e/');
    }
    return res.json({ success: true, streamUrl });
  }

  let htmlData = "";
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(urlNinja)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(urlNinja)}`
  ];

  for (const proxy of proxies) {
    try {
      const response = await axios.get(proxy, { timeout: 8000 });
      htmlData = typeof response.data === 'object' && response.data.contents ? response.data.contents : response.data;
      if (htmlData && htmlData.includes('iframe')) break;
    } catch (e) {
      continue;
    }
  }

  if (!htmlData) {
    return res.status(504).json({ error: "No se pudo extraer el origen. Intenta de nuevo." });
  }

  try {
    const $ = cheerio.load(htmlData);
    let directVideoUrl = null;

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('disqus')) {
        directVideoUrl = src;
        return false;
      }
    });

    if (!directVideoUrl) {
      return res.status(404).json({ error: "No se encontró fuente de vídeo válida." });
    }

    if (directVideoUrl.startsWith('//')) directVideoUrl = 'https:' + directVideoUrl;

    // Enviar a la API de StreamHG vía Remote Upload
    const streamHgRes = await axios.get(`https://streamhg.com/api/upload/url?key=${STREAMHG_API_KEY}&url=${encodeURIComponent(directVideoUrl)}`);

    if (streamHgRes.data && streamHgRes.data.result && streamHgRes.data.result.filecode) {
      const embedUrl = `https://streamhg.com/e/${streamHgRes.data.result.filecode}`;
      return res.json({ success: true, streamUrl: embedUrl });
    } else {
      // Fallback si la subida remota responde directo con el iframe
      return res.json({ success: true, streamUrl: directVideoUrl });
    }

  } catch (error) {
    res.status(500).json({ error: "Error procesando con la API de StreamHG." });
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
