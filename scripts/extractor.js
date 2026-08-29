const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

async function extraerCatalogoReal() {
  console.log("Iniciando extracción mediante Jikan API (MyAnimeList)...");

  try {
    // Obtenemos los animes más populares/recientes directamente
    const res = await axios.get('https://api.jikan.moe/v4/top/anime?limit=15', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const datos = res.data.data || [];
    const catalogo = [];

    datos.forEach(item => {
      // Generar slug para AnimeFLV
      const cleanSlug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');

      catalogo.push({
        id: cleanSlug,
        title: item.title_japanese ? `${item.title} (${item.title_japanese})` : item.title,
        poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || "",
        idioma: "Español Latino / Sub",
        servers: [
          {
            server: "animeflv",
            title: "Ver en AnimeFLV",
            code: `https://animeflv.net/anime/${cleanSlug}`
          },
          {
            server: "stream",
            title: "Opción HD",
            code: item.url || "#"
          }
        ]
      });
    });

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log(`¡Éxito total! Se extrajeron ${catalogo.length} animes reales y se guardaron en latino.json.`);
    } else {
      console.log("No se obtuvieron datos.");
    }

  } catch (error) {
    console.error("Error consultando la API:", error.message);
  }
}

extraerCatalogoReal();
