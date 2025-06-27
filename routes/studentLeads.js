const express = require('express');
const router = express.Router();
const db = require('../db'); // connexion PG

// POST /api/student-leads
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, school, region, email } = req.body;

    // Validation rapide
    if (!firstName || !lastName || !school || !region || !email) {
      return res.status(400).json({ success: false, message: 'Champs requis manquants' });
    }

    // Insertion dans la table student_leads
    await db.query(
      `INSERT INTO public.student_leads (first_name, last_name, school, region, email)
       VALUES ($1, $2, $3, $4, $5)`,
      [firstName, lastName, school, region, email]
    );

    res.json({ success: true, message: 'Lead enregistré' });
  } catch (error) {
    console.error('Erreur insertion lead:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
