const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../latino.json');
const pausar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function obtenerTodosLosEpisodios(animeId) {
  let episodios = [];
  let offset = 0;
  const limit = 20;
  let hayMas = true;

  while (hayMas) {
    try {
      const url = `https://kitsu.io/api/edge/anime/${animeId}/episodes?page[limit]=${limit}&page[offset]=${offset}`;
      const res = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        timeout: 10000
      });

      const epData = res.data.data || [];
      
      epData.forEach(ep => {
        const epAttr = ep.attributes;
        const numEp = epAttr.number || (episodios.length + 1);
        episodios.push({
          numero: numEp,
          titulo: epAttr.canonicalTitle || epAttr.titles?.en_jp || `Episodio ${numEp}`,
          sinopsis: epAttr.synopsis || "Sin descripción disponible.",
          poster: epAttr.thumbnail?.original || ""
        });
      });

      if (epData.length < limit) {
        hayMas = false;
      } else {
        offset += limit;
        await pausar(500);
      }
    } catch (err) {
      hayMas = false;
    }
  }

  return episodios;
}

async function extraccionMasivaMultiIdioma() {
  console.log("Iniciando extracción masiva Multi-Idioma (Latino / Castellano)...");
  const catalogo = [];
  const limitePorPagina = 20;
  const paginasTotales = 5; // 100 Animes

  try {
    for (let p = 0; p < paginasTotales; p++) {
      const offsetAnime = p * limitePorPagina;
      console.log(`\n--- CARGANDO PÁGINA ${p + 1} DE ANIMES ---`);

      const urlAnime = `https://kitsu.io/api/edge/anime?page[limit]=${limitePorPagina}&page[offset]=${offsetAnime}&sort=-userCount`;
      const res = await axios.get(urlAnime, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        timeout: 10000
      });

      const listaAnimes = res.data.data || [];

      for (let i = 0; i < listaAnimes.length; i++) {
        const item = listaAnimes[i];
        const attr = item.attributes;
        const title = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
        const cleanSlug = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');

        const indiceGlobal = offsetAnime + i + 1;
        console.log(`[${indiceGlobal}/100] Procesando episodios de: ${title}...`);

        const listaCapitulos = await obtenerTodosLosEpisodios(item.id);

        catalogo.push({
          id: cleanSlug,
          title: title,
          poster: attr.posterImage?.small || attr.posterImage?.original || "",
          sinopsis: attr.synopsis || "",
          idiomas_disponibles: ["Español Latino / Sub", "Español Castellano"],
          total_episodios: listaCapitulos.length,
          capitulos: listaCapitulos.map(ep => ({
            ...ep,
            opciones_reproductor: [
              {
                idioma: "Latino / Sub",
                servidor: "AnimeFLV",
                url: `https://animeflv.net/ver/${cleanSlug}-${ep.numero}`
              },
              {
                idioma: "Castellano",
                servidor: "Servidor ES",
                url: `https://animeflv.es/ver/${cleanSlug}-${ep.numero}`
              }
            ]
          }))
        });

        await pausar(1000);
      }

      await pausar(2000);
    }

    if (catalogo.length > 0) {
      fs.writeFileSync(JSON_PATH, JSON.stringify(catalogo, null, 2));
      console.log(`\n¡PROCESO COMPLETADO! Catálogo multi-idioma listo.`);
    }

  } catch (error) {
    console.error("Error durante la extracción:", error.message);
  }
}

extraccionMasivaMultiIdioma();
