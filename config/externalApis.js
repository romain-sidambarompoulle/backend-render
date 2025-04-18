// Fichier: backend-render/config/externalApis.js

module.exports = {
    GOOGLE_SHEET_URL: process.env.GOOGLE_SHEET_URL,
    OPENAI_API_URL: process.env.OPENAI_API_URL,
    // TODO: Centraliser aussi les API_URLS du simulateur ici si pertinent

    // ✨ NOUVEAU: URLs des simulateurs
    SIMULATOR_URLS: {
      kine: process.env.SIM_KINE_URL,
      sagefemme: process.env.SIM_SAGEFEMME_URL,
      infirmier: process.env.SIM_INFIRMIER_URL,
    },
  };