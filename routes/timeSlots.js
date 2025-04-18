const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const db = require('../db');

// Créer un créneau horaire (admin uniquement)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { start_datetime, end_datetime, status = 'available', type } = req.body;
    
    console.log(`🕒 Création d'un nouveau créneau horaire: ${start_datetime} - ${end_datetime}`);
    
    // Vérification des données requises
    if (!start_datetime || !end_datetime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Les dates de début et de fin sont requises' 
      });
    }
    
    // Vérification que la date de fin est après la date de début
    if (new Date(end_datetime) <= new Date(start_datetime)) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être postérieure à la date de début'
      });
    }
    
    // Insertion du créneau dans la base de données
    const result = await db.query(
      `INSERT INTO time_slots (start_datetime, end_datetime, status, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [start_datetime, end_datetime, status, type]
    );
    
    console.log('✅ Créneau créé avec succès');
    res.status(201).json({
      success: true,
      message: 'Créneau créé avec succès',
      timeSlot: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création du créneau:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du créneau',
      error: error.message
    });
  }
});

// Modifier un créneau horaire (admin uniquement)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_datetime, end_datetime, status, type } = req.body;
    
    console.log(`🔄 Modification du créneau ${id}`);
    
    // Vérification que le créneau existe
    const checkResult = await db.query('SELECT * FROM time_slots WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Créneau non trouvé'
      });
    }
    
    // Construction de la requête de mise à jour
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    if (start_datetime !== undefined) {
      updateFields.push(`start_datetime = $${paramIndex}`);
      values.push(start_datetime);
      paramIndex++;
    }
    
    if (end_datetime !== undefined) {
      updateFields.push(`end_datetime = $${paramIndex}`);
      values.push(end_datetime);
      paramIndex++;
    }
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    
    if (type !== undefined) {
      updateFields.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Si aucun champ à mettre à jour, renvoyer une erreur
    if (updateFields.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ à mettre à jour'
      });
    }
    
    // Ajout de l'ID à la fin des valeurs
    values.push(id);
    
    // Exécution de la mise à jour
    const result = await db.query(
      `UPDATE time_slots 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    console.log('✅ Créneau mis à jour avec succès');
    res.json({
      success: true,
      message: 'Créneau mis à jour avec succès',
      timeSlot: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erreur lors de la modification du créneau:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du créneau',
      error: error.message
    });
  }
});

// Récupérer tous les créneaux disponibles (utilisateur authentifié)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 Récupération des créneaux disponibles');
    
    const result = await db.query(
      `SELECT * FROM time_slots 
       WHERE status = 'available' AND start_datetime >= NOW()
       ORDER BY start_datetime ASC`
    );
    
    res.json({
      success: true,
      timeSlots: result.rows
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des créneaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des créneaux',
      error: error.message
    });
  }
});

// Supprimer un créneau horaire (admin uniquement)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Suppression du créneau ${id}`);
    
    // Vérifier que le créneau existe
    const checkResult = await db.query('SELECT * FROM time_slots WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Créneau non trouvé'
      });
    }
    
    // Vérifier si le créneau n'est pas déjà réservé
    if (checkResult.rows[0].status === 'booked') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un créneau déjà réservé'
      });
    }
    
    // Supprimer le créneau
    await db.query('DELETE FROM time_slots WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Créneau supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du créneau:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du créneau',
      error: error.message
    });
  }
});

module.exports = router;
