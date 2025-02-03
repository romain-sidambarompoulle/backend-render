const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // Autorise les requêtes depuis le frontend
app.use(express.json());

// Route de test pour vérifier que le backend est actif
app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

// Route pour traiter les données du formulaire
app.post("/submit-form", (req, res) => {
  console.log("Données reçues :", req.body); // Affiche les données dans la console

  if (!req.body.nom || !req.body.email) {
    return res.status(400).json({ error: "Le nom et l'email sont requis." });
  }

  res.json({ success: true, message: "Formulaire reçu avec succès." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
