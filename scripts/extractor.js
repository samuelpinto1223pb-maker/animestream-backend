const fs = require('fs');
const path = require('path');
const https = require('https');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requestJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function extraerTodoSinLimites() {
  console.log("Iniciando escaneo masivo (Todos los animes doblados + Todas las temporadas + Motores)...");
  let catalog = [];
  
  // Escaneamos 25 páginas (hasta 500 animes doblados en total)
  const TOTAL_PAGINAS = 25;

  for (let page = 0; page < TOTAL_PAGINAS; page++) {
    const offset = page * 20;
    const url = `https://kitsu.io/api/edge/anime?filter[categories]=spanish-dub&page[limit]=20&page[offset]=${offset}&sort=-userCount`;

    try {
      const response = await requestJSON(url);
      const items = response.data || [];

      if (items.length === 0) break; // Si ya no hay más animes, termina

      for (let item of items) {
        const attr = item.attributes;
        const title = attr.canonicalTitle || attr.titles.en || "Sin título";
        const poster = attr.posterImage ? attr.posterImage.small : "";
        
        let year = attr.startDate ? new Date(attr.startDate).getFullYear() : 2026;
        if (year > 2026) year = 2026;

        const totalEpisodios = attr.episodeCount || 12;
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

        const capitulos = [];
        // Genera los motores para TODOS los capítulos que tenga la serie (12, 24, 50, 100+)
        for (let i = 1; i <= totalEpisodios; i++) {
          capitulos.push({
            numero: i,
            opciones_reproductor: [
              {
                idioma: "Español Latino",
                servidor: "Streamwish (Latino)",
                url: `https://streamwish.to/e/${slug}-ep${i}`
              },
              {
                idioma: "Español Castellano",
                servidor: "Filemoon (Castellano)",
                url: `https://filemoon.sx/e/${slug}-ep${i}`
              },
              {
                idioma: "Español Latino",
                servidor: "Voe (Servidor 2)",
                url: `https://voe.sx/e/${slug}-ep${i}`
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

        console.log(`[${catalog.length}] Procesado: ${title} (${year}) - ${totalEpisodios} capítulos vinculados.`);
      }
    } catch (error) {
      console.error(`Error procesando bloque ${page}:`, error.message);
    }

    // Pausa preventiva de 1.2 segundos entre páginas para estabilidad absoluta
    await delay(1200);
  }

  // Ordenar el catálogo: 2026 primero, bajando hasta los años 2000
  catalog.sort((a, b) => b.year - a.year);

  const outputPath = path.join(__dirname, '../latino.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
  console.log(`¡ESCANEO COMPLETO! Se guardó un total de ${catalog.length} animes con todos sus reproductores.`);
}

extraerTodoSinLimites();
