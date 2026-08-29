const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

async function extraerCatalogoReal() {
  console.log("Iniciando extracción mediante Kitsu API...");

  try {
    // Petición directa a Kitsu API (extremadamente rápida y sin bloqueos 504)
    const res = await axios.get('https://kitsu.io/api/edge/anime?page[limit]=15&sort=-userCount', {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      timeout: 10000
    });

    const datos = res.data.data || [];
    const catalogo = [];

    datos.forEach(item => {
      const attr = item.attributes;
      const title = attr.canonicalTitle || attr.titles.en_jp || "Anime";
      
      const cleanSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');

      catalogo.push({
        id: cleanSlug,
        title: title,
        poster: attr.posterImage?.small || attr.posterImage?.original || "",
        idioma: "Español Latino / Sub",
        servers: [
          {
            server: "animeflv",
            title: "Ver en AnimeFLV",
            code: `https://animeflv.net/anime/${cleanSlug}`
          }
        ]
      });
    });

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log(`¡Éxito! Se extrajeron ${catalogo.length} animes reales correctamente.`);
    }

  } catch (error) {
    console.error("Error consultando la API:", error.message);
  }
}

extraerCatalogoReal();
