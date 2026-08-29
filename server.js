const express = require('express');
const cors = require('cors');
const axios = require('axios');
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

// PROCESAR ENLACE CON STREAMHG API DIRECTO
app.post('/api/extraer-ninja', async (req, res) => {
  const { urlNinja } = req.body;
  if (!urlNinja) return res.status(400).json({ error: "Falta la URL del episodio" });

  let streamUrl = urlNinja.trim();

  // Si ya es un enlace embed de StreamHG
  if (streamUrl.includes('streamhg.com/e/')) {
    return res.json({ success: true, streamUrl });
  }

  // Si es un enlace normal de StreamHG, convertir a embed
  if (streamUrl.includes('streamhg.com/')) {
    streamUrl = streamUrl.replace('streamhg.com/', 'streamhg.com/e/');
    return res.json({ success: true, streamUrl });
  }

  // Mandar la URL externa a StreamHG mediante Remote Upload
  try {
    const remoteRes = await axios.get(`https://streamhg.com/api/upload/url?key=${STREAMHG_API_KEY}&url=${encodeURIComponent(streamUrl)}`);

    if (remoteRes.data && remoteRes.data.result && remoteRes.data.result.filecode) {
      const finalEmbed = `https://streamhg.com/e/${remoteRes.data.result.filecode}`;
      return res.json({ success: true, streamUrl: finalEmbed });
    } else {
      // Si la API no lo convierte al instante, usa la URL tal cual
      return res.json({ success: true, streamUrl: streamUrl });
    }
  } catch (error) {
    // Si falla la API de StreamHG, carga la URL original en el reproductor
    return res.json({ success: true, streamUrl: streamUrl });
  }
});

app.post('/api/admin/agregar-anime', (req, res) => {
  let { titulo, imagen, urlNinja } = req.body;

  if (!urlNinja) {
    return res.status(400).json({ error: "Debes pegar al menos el enlace del video" });
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
