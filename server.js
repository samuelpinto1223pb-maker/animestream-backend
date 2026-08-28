const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN Y CONTROL DE CAPACIDAD
let configServidor = {
  limiteUsuarios: 10,     // Límite para plan gratuito (Render)
  usuariosActivos: 0,
  claveAdmin: "admin2026"  // Contraseña de administración
};

// ENCABEZADOS ANTIBLOQUEO (Para evitar error 403 de Cloudflare)
const HEADERS_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer': 'https://ww3.animeonline.ninja/',
  'Cache-Control': 'no-cache'
};

// 1. MONITOREO DEL ESTADO DEL SERVIDOR
app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

// 2. PANEL DE ADMINISTRACIÓN (Cambio de límite en tiempo real)
app.post('/api/admin/ajustar-limite', (req, res) => {
  const { pass, nuevoLimite } = req.body;
  if (pass !== configServidor.claveAdmin) {
    return res.status(403).json({ error: "Clave de administrador incorrecta" });
  }
  configServidor.limiteUsuarios = parseInt(nuevoLimite);
  res.json({ 
    mensaje: `¡Límite actualizado a ${configServidor.limiteUsuarios} usuarios!`,
    limiteActual: configServidor.limiteUsuarios 
  });
});

// 3. EXTRAER CATÁLOGO REAL EN VIVO (Con fotos e información original)
app.get('/api/catalogo-ninja', async (req, res) => {
  try {
    const response = await axios.get('https://ww3.animeonline.ninja/', {
      headers: HEADERS_NAVEGADOR,
      timeout: 12000
    });

    const $ = cheerio.load(response.data);
    const listaAnimes = [];

    $('article, .item, .post').each((index, el) => {
      const titulo = $(el).find('.title, h2, h3').text().trim();
      const urlAnime = $(el).find('a').attr('href');
      let imagen = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');

      if (imagen && imagen.startsWith('//')) {
        imagen = 'https:' + imagen;
      }

      if (titulo && urlAnime && imagen) {
        listaAnimes.push({ titulo, urlAnime, imagen });
      }
    });

    res.json({ success: true, animes: listaAnimes.slice(0, 12) });
  } catch (error) {
    console.error("Error al obtener catálogo:", error.message);
    res.status(500).json({ error: "No se pudo cargar el catálogo de la fuente." });
  }
});

// 4. EXTRAER MOTORES DE VIDEO DEL EPISODIO (Con protección antibloqueo 403)
app.post('/api/extraer-ninja', async (req, res) => {
  if (configServidor.usuariosActivos >= configServidor.limiteUsuarios) {
    return res.status(429).json({ 
      error: "Servidor Lleno", 
      mensaje: "Capacidad máxima alcanzada. Intenta de nuevo en unos minutos.",
      saturado: true 
    });
  }

  const { urlNinja } = req.body;
  if (!urlNinja) {
    return res.status(400).json({ error: "Falta la URL de la página de anime" });
  }

  configServidor.usuariosActivos++;

  try {
    const response = await axios.get(urlNinja, {
      headers: HEADERS_NAVEGADOR,
      timeout: 12000
    });

    const $ = cheerio.load(response.data);

    // Escanear iframe principal u opciones secundarias
    let streamUrl = $('iframe').attr('src') || $('iframe').attr('data-src');

    if (!streamUrl) {
      streamUrl = $('.option-to-play iframe').attr('src') || $('#option-1 iframe').attr('src');
    }

    if (!streamUrl) {
      if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
      return res.status(404).json({ error: "No se encontró el reproductor de video en esa URL." });
    }

    if (streamUrl.startsWith('//')) {
      streamUrl = 'https:' + streamUrl;
    }

    res.json({ success: true, streamUrl });

  } catch (error) {
    if (configServidor.usuariosActivos > 0) configServidor.usuariosActivos--;
    console.error("Error extrayendo video:", error.message);
    res.status(500).json({ error: "No se pudo obtener el video de la fuente." });
  }
});

// 5. LIBERACIÓN AUTOMÁTICA DE CUPO
app.post('/api/liberar-cupo', (req, res) => {
  if (configServidor.usuariosActivos > 0) {
    configServidor.usuariosActivos--;
  }
  res.json({ activos: configServidor.usuariosActivos });
});

// ARRANCAR SERVIDOR EN RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
