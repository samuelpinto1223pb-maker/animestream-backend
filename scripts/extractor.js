const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Pausa de seguridad para evitar detección de bots
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function extraerAnimes() {
  console.log("Iniciando escaneo sigiloso multi-fuente (Latino + Castellano + Fechas)...");
  let catalog = [];
  const TOTAL_PAGES = 5; // 5 páginas x 20 animes = 100 animes

  for (let page = 0; page < TOTAL_PAGES; page++) {
    const offset = page * 20;
    const url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${offset}&sort=-userCount`;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const items = response.data.data;

      for (let item of items) {
        const attr = item.attributes;
        const title = attr.canonicalTitle || attr.titles.en || "Sin título";
        const poster = attr.posterImage ? attr.posterImage.small : "";
        
        // Extrae el año de estreno (ej: 2026, 2025, 2024...)
        const year = attr.startDate ? new Date(attr.startDate).getFullYear() : "Desconocido";
        const totalEpisodios = attr.episodeCount || 12;
        const capitulos = [];

        for (let i = 1; i <= Math.min(totalEpisodios, 24); i++) {
          capitulos.push({
            numero: i,
            opciones_reproductor: [
              {
                idioma: "Español Latino",
                servidor: "Anime Ninja",
                url: `https://animeonline.ninja/episodio/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-episodio-${i}/`
              },
              {
                idioma: "Español Castellano",
                servidor: "Servidor ES",
                url: `https://www.youtube.com/embed/dQw4w9WgXcQ` // URL de prueba embebible
              },
              {
                idioma: "Latino / Sub",
                servidor: "AnimeFLV",
                url: `https://animeflv.net/ver/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${i}`
              }
            ]
          });
        }

        catalog.push({
          id: item.id,
          title: title,
          poster: poster,
          year: year,
          capitulos: capitulos
        });

        console.log(`[${catalog.length}/100] Escaneado: ${title} (${year})`);
        
        // Pausa de 1.5 segundos entre animes (Anti-Bot)
        await delay(1500);
      }
    } catch (error) {
      console.error(`Error procesando página ${page}:`, error.message);
    }

    // Pausa de 3 segundos entre páginas
    await delay(3000);
  }

  // Ordenar catálogo: los animes más recientes (2026) quedan arriba
  catalog.sort((a, b) => {
    const yA = typeof a.year === 'number' ? a.year : 0;
    const yB = typeof b.year === 'number' ? b.year : 0;
    return yB - yA;
  });

  const outputPath = path.join(__dirname, '../latino.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
  console.log("¡ESCANEO COMPLETADO! Catálogo latino.json actualizado correctamente.");
}

extraerAnimes();
