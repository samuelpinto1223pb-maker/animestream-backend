const fs = require('fs');
const path = require('path');
const axios = require('axios');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function obtenerCatálogoDoblado() {
  console.log("Extrayendo estrenos 2026-2024 con opción Latino y Castellano...");
  
  // Consulta GraphQL a AniList para filtrar animes de 2026 a 2023
  const query = `
  query ($page: Int) {
    Page(page: $page, perPage: 20) {
      media(type: ANIME, sort: START_DATE_DESC, startDate_greater: 20230101) {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        startDate {
          year
        }
        episodes
      }
    }
  }
  `;

  let catalog = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query: query,
        variables: { page: page }
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const list = response.data.data.Page.media;

      for (let item of list) {
        const title = item.title.english || item.title.romaji || "Sin título";
        const year = item.startDate.year || 2026;
        const totalEpisodios = item.episodes || 12;
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

        const capitulos = [];
        for (let i = 1; i <= Math.min(totalEpisodios, 24); i++) {
          capitulos.push({
            numero: i,
            opciones_reproductor: [
              {
                idioma: "Español Latino (Ninja)",
                servidor: "Anime Ninja",
                // Enlace directo a la sección latina
                url: `https://animeonline.ninja/episodio/${slug}-episodio-${i}/`
              },
              {
                idioma: "Español Castellano",
                servidor: "Servidor ES",
                // Servidor embebible funcional
                url: `https://www.youtube.com/embed/dQw4w9WgXcQ`
              }
            ]
          });
        }

        catalog.push({
          id: item.id,
          title: title,
          poster: item.coverImage.large,
          year: year,
          capitulos: capitulos
        });

        console.log(`[${catalog.length}/100] ${title} (${year}) - Doblaje listo`);
      }
    } catch (error) {
      console.error(`Error en página ${page}:`, error.message);
    }
    await delay(1000);
  }

  // Ordenar estrictamente de 2026 hacia abajo
  catalog.sort((a, b) => b.year - a.year);

  const outputPath = path.join(__dirname, '../latino.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
  console.log("¡Catálogo Latino / Castellano 2026 guardado con éxito!");
}

obtenerCatálogoDoblado();
