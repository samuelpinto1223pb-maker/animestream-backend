const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// CONTROL DE CAPACIDAD Y CONFIGURACIÓN
let configServidor = {
  limiteUsuarios: 10,     // Límite para plan gratuito (Render)
  usuariosActivos: 0,
  claveAdmin: "admin2026"  // Tu contraseña para cambiar el límite
};

// 1. ESTADO DEL SERVIDOR
app.get('/api/estado-servidor', (req, res) => {
  res.json({
    activos: configServidor.usuariosActivos,
    limite: configServidor.limiteUsuarios,
    disponible: configServidor.usuariosActivos < configServidor.limiteUsuarios
  });
});

// 2. PANEL ADMIN: Cambiar el límite en vivo
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

// 3. EXTRAER VIDEO DE ANIME ONLINE NINJA
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://ww3.animeonline.ninja/'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

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
    console.error("Error extrayendo:", error.message);
    res.status(500).json({ error: "No se pudo obtener el video de la fuente." });
  }
});

// 4. DESCONECTAR USUARIO (Liberar cupo)
app.post('/api/liberar-cupo', (req, res) => {
  if (configServidor.usuariosActivos > 0) {
    configServidor.usuariosActivos--;
  }
  res.json({ activos: configServidor.usuariosActivos });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
