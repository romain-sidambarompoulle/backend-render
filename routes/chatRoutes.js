const express = require('express');
const router = express.Router();
// Adaptez l'importation de votre pool de connexion à la base de données
const pool = require('../db'); // Exemple: Assurez-vous que ce chemin est correct

// POST /api/chat/messages
router.post('/messages', async (req, res) => {
  const { email, content } = req.body;

  // Validation simple
  if (!email || !content) {
    return res.status(400).json({ success: false, message: 'Email et contenu sont requis.' });
  }

  // Validation basique de l'email (peut être améliorée)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Format de l\'email invalide.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO messages (email, content) VALUES ($1, $2) RETURNING id, created_at',
      [email, content]
    );

    console.log('Message enregistré:', result.rows[0]);
    res.status(201).json({
        success: true,
        message: 'Message enregistré avec succès.',
        data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du message:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'enregistrement du message.' });
  }
});

module.exports = router;