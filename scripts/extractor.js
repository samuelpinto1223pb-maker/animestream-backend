const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');

// Función auxiliar para forzar la pausa
const pausar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extraerCatalogoLento() {
  console.log("Iniciando extracción progresiva con pausas de seguridad...");
  
  const catalogo = [];
  const limitePorPagina = 50;
  const paginasTotales = 5; // 5 páginas x 50 = 250 animes
  const tiempoPausa = 2000; // 2000 ms = 2 segundos de espera entre llamadas

  try {
    for (let i = 0; i < paginasTotales; i++) {
      const offset = i * limitePorPagina;
      console.log(`[Página ${i + 1}/${paginasTotales}] Descargando animes del ${offset + 1} al ${offset + limitePorPagina}...`);

      const url = `https://kitsu.io/api/edge/anime?page[limit]=${limitePorPagina}&page[offset]=${offset}&sort=-userCount`;
      
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        timeout: 10000
      });

      const datos = res.data.data || [];

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

      // Pausa obligatoria si aún quedan páginas por descargar
      if (i < paginasTotales - 1) {
        console.log(`Esperando ${tiempoPausa / 1000} segundos para no saturar el servicio...`);
        await pausar(tiempoPausa);
      }
    }

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log(`¡Éxito! Se procesaron lentamente ${catalogo.length} animes y se guardaron en latino.json.`);
    }

  } catch (error) {
    console.error("Error durante la extracción lenta:", error.message);
  }
}

extraerCatalogoLento();
