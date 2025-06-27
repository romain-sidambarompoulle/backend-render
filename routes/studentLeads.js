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

// GET /api/student-leads  ➜  liste complète des inscrits
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, first_name, last_name, school, region, email, created_at FROM public.student_leads ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur récupération leads:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/student-leads/:id  ➜  suppression d'un inscrit
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.student_leads WHERE id = $1', [id]);
    res.json({ success: true, message: 'Lead supprimé' });
  } catch (error) {
    console.error('Erreur suppression lead:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
