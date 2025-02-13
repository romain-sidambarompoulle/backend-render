const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config(); // Permet d'utiliser les variables d'environnement

const app = express();

// Si tu veux autoriser seulement localhost:5174 en dev, tu peux mettre :
// app.use(cors({ origin: "http://localhost:5174" }));
// Sinon, app.use(cors()) autorise *tout* domaine :
app.use(cors());

// Pour parser le JSON entrant
app.use(express.json());

// URL de ton Google Apps Script
// (assure-toi de bien avoir déployé ton script en "Application Web" et autorisé l'accès)
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyRgj-BfUdkIG1yPbosWHQ03qzanvcx3vYCejnGWDU0nAgimpPRLjhcYsrTKqjvf3N18w/exec";

// URL de l'API OpenAI
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Route de test pour vérifier que le backend est actif
app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

// 📌 **Route pour envoyer les données à Google Sheets (proxy vers Apps Script)**
app.post("/submit-form", async (req, res) => {
  try {
    console.log("📩 Données reçues sur /submit-form :", req.body);

    // Vérifier si les champs essentiels sont remplis (optionnel)
    if (!req.body.nom || !req.body.email) {
      return res.status(400).json({ success: false, message: "Le nom et l'email sont requis." });
    }

    // On transmet la requête au Script Apps Script
    const response = await axios.post(GOOGLE_SHEET_URL, req.body, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Réponse de Google Sheets :", response.data);

    // On renvoie la réponse brute du script Apps Script à notre front
    // Ainsi, s’il renvoie { status: "success", message: "..." }, on le reçoit tel quel
    res.json(response.data);

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
