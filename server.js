const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // Autorise les requêtes depuis le frontend
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
