const express = require("express");
const cors = require("cors");
const axios = require("axios"); // Importer Axios

const app = express();
app.use(cors()); // Autoriser les requêtes CORS
app.use(express.json());

// URL de ton Google Apps Script
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwQSyUSs6oYCRXXHZ5NYsL_SbrU-QBlQqYg4JPiOcoeurMdr8X3QYC77bhC7exjnybuvA/exec";

// Route de test pour vérifier que le backend est actif
app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

// Route pour traiter les données du formulaire et les envoyer à Google Sheets
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

    // Répondre au frontend
    res.json({ success: true, message: "Données envoyées à Google Sheets." });

  } catch (error) {
    console.error("❌ Erreur lors de l'envoi à Google Sheets :", error.message);
    res.status(500).json({ success: false, message: "Erreur d'envoi à Google Sheets." });
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
