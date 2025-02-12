const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config(); // Permet d'utiliser les variables d'environnement

const app = express();
app.use(cors()); // Autoriser les requêtes CORS
app.use(express.json());

// URL de ton Google Apps Script
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxg7cjesH3luK9WDC0nTKddPlMzYlDPcn3gIsBifgmrGetEnkGmBa_or67shHK33wFmPQ/exec";

// URL de l'API OpenAI
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Route de test pour vérifier que le backend est actif
app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

// 📌 **Route pour envoyer les données à Google Sheets**
app.post("/submit-form", async (req, res) => {
  try {
    console.log("📩 Données reçues :", req.body);

    // Vérifier si les champs essentiels sont remplis
    if (!req.body.nom || !req.body.email) {
      return res.status(400).json({ success: false, message: "Le nom et l'email sont requis." });
    }

    // Envoi des données à Google Sheets
    const response = await axios.post(GOOGLE_SHEET_URL, req.body, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("✅ Réponse de Google Sheets :", response.data);
    res.json({ success: true, message: "Données envoyées à Google Sheets." });

  } catch (error) {
    console.error("❌ Erreur lors de l'envoi à Google Sheets :", error.message);
    res.status(500).json({ success: false, message: "Erreur d'envoi à Google Sheets." });
  }
});

// 📌 **Route pour le Chatbot OpenAI**
app.post("/chatbot", async (req, res) => {
  try {
    console.log("📩 Message reçu :", req.body);

    if (!req.body.message) {
      return res.status(400).json({ success: false, message: "Le message est requis." });
    }

    // Envoyer la requête à OpenAI
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4",
        messages: [{ role: "user", content: req.body.message }],
        max_tokens: 100,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Réponse OpenAI :", response.data);
    res.json({ success: true, response: response.data.choices[0].message.content });

  } catch (error) {
    console.error("❌ Erreur OpenAI :", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Erreur lors de la communication avec OpenAI." });
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
