const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

async function extraerCatalogoReal() {
  console.log("Iniciando extracción mediante REST API activa...");

  try {
    // Consultamos la API pública directa
    const res = await axios.get('https://animeflv.ahmedrangel.com/api/list/latest-animes', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const datos = res.data.data || res.data || [];
    const catalogo = [];

    datos.slice(0, 20).forEach(item => {
      catalogo.push({
        id: item.id || item.slug || "anime-latino",
        title: item.title || item.name,
        poster: item.poster || item.cover || item.image || "",
        idioma: (item.title || "").toLowerCase().includes('latino') ? "Español Latino" : "Subtitulado",
        servers: [
          {
            server: "default",
            title: "Ver Anime",
            code: item.url || `https://animeflv.net/anime/${item.id}`
          }
        ]
      });
    });

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log(`¡Éxito real! Se extrajeron ${catalogo.length} animes reales y se guardaron en latino.json.`);
    } else {
      console.log("La API devolvió un arreglo vacío.");
    }

  } catch (error) {
    console.error("Error consultando la API:", error.message);
  }
}

extraerCatalogoReal();
