const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const db = require('../db');
// Importation des fonctions d'envoi d'email et des templates
const { sendEmail } = require('../utils/mailer');
const { phoneAppointmentTemplate, strategyAppointmentTemplate, adminAppointmentCanceledTemplate } = require('../utils/emailTemplates');

// Réserver un créneau (utilisateur authentifié)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { time_slot_id, type } = req.body;
    
    console.log(`📅 Tentative de réservation du créneau ${time_slot_id} par l'utilisateur`);
    
    // Vérification des données requises
    if (!time_slot_id) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID du créneau est requis'
      });
    }
    
    // Récupérer l'ID de l'utilisateur à partir de son email
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const userId = userResult.rows[0].id;
    
    // Vérifier que le créneau existe et est disponible
    const timeSlotResult = await db.query(
      'SELECT * FROM time_slots WHERE id = $1 AND status = $2',
      [time_slot_id, 'available']
    );
    
    if (timeSlotResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Créneau non disponible ou inexistant'
      });
    }
    
    // Démarrer une transaction
    await db.query('BEGIN');
    
    try {
      // Mettre à jour le statut du créneau
      await db.query(
        'UPDATE time_slots SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['booked', time_slot_id]
      );
      
      // Créer le rendez-vous
      const rdvResult = await db.query(
        `INSERT INTO rdv (user_id, time_slot_id, type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, time_slot_id, type || timeSlotResult.rows[0].type, 'scheduled']
      );
      
      // Mettre à jour la progression de l'utilisateur si nécessaire
      if (type === 'tel' || timeSlotResult.rows[0].type === 'tel') {
        await db.query(
          'UPDATE profiles SET progression_rdv_phone = 100 WHERE user_id = $1',
          [userId]
        );
      } else if (type === 'strat' || timeSlotResult.rows[0].type === 'strat') {
        await db.query(
          'UPDATE profiles SET progression_rdv_strategy = 100 WHERE user_id = $1',
          [userId]
        );
      }
      
      await db.query('COMMIT');
      
      // Envoi d'un email de confirmation
      try {
        // Récupérer les informations complètes de l'utilisateur
        const userQuery = await db.query('SELECT nom, prenom, email FROM users WHERE id = $1', [userId]);
        const user = userQuery.rows[0];
        
        // Récupérer les informations du créneau pour l'email
        const startDate = new Date(timeSlotResult.rows[0].start_datetime);
        const formattedDate = startDate.toLocaleDateString('fr-FR', { 
          day: '2-digit', month: '2-digit', year: 'numeric' 
        });
        const formattedTime = startDate.toLocaleTimeString('fr-FR', { 
          hour: '2-digit', minute: '2-digit' 
        });
        
        // Préparer les données pour le template
        const emailData = {
          userName: `${user.prenom} ${user.nom}`,
          date: formattedDate,
          time: formattedTime
        };
        
        // Choisir le bon template en fonction du type de rendez-vous
        const rendezVousType = type || timeSlotResult.rows[0].type;
        let emailTemplate;
        let emailSubject;
        
        if (rendezVousType === 'tel') {
          emailTemplate = phoneAppointmentTemplate(emailData);
          emailSubject = 'Confirmation de votre rendez-vous téléphonique';
        } else if (rendezVousType === 'strat') {
          emailTemplate = strategyAppointmentTemplate(emailData);
          emailSubject = 'Confirmation de votre rendez-vous stratégique';
        }
        
        // Envoyer l'email si un template est défini
        if (emailTemplate) {
          await sendEmail(user.email, emailSubject, emailTemplate);
          console.log(`📧 Email de confirmation envoyé à ${user.email}`);
          
          // ✨ NOUVEAU: Envoyer un email à l'admin
          const adminHTML = `<p>Un utilisateur vient de prendre un rendez-vous ${rendezVousType === 'tel' ? 'téléphonique' : 'stratégique'}:</p>
            <ul>
              <li>Utilisateur: ${user.prenom} ${user.nom}</li>
              <li>Email: ${user.email}</li>
              <li>Date: ${formattedDate}</li>
              <li>Heure: ${formattedTime}</li>
            </ul>`;
          await sendEmail(process.env.GMAIL_USER, `Nouveau rendez-vous ${rendezVousType === 'tel' ? 'téléphonique' : 'stratégique'}`, adminHTML);
          console.log(`📧 Email de notification envoyé à l'administrateur`);
        }
      } catch (emailError) {
        // Ne pas bloquer le processus si l'envoi d'email échoue
        console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
      }
      
      console.log('✅ Rendez-vous créé avec succès');
      res.status(201).json({
        success: true,
        message: 'Rendez-vous créé avec succès',
        appointment: rdvResult.rows[0]
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rendez-vous',
      error: error.message
    });
  }
});

// Récupérer tous les rendez-vous (admin uniquement)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🔍 Récupération de tous les rendez-vous');
    
    const result = await db.query(`
      SELECT r.*, u.nom, u.prenom, u.email, 
             ts.start_datetime, ts.end_datetime, ts.type as time_slot_type
      FROM rdv r
      JOIN users u ON r.user_id = u.id
      JOIN time_slots ts ON r.time_slot_id = ts.id
      ORDER BY ts.start_datetime DESC
    `);
    
    res.json({
      success: true,
      appointments: result.rows
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous',
      error: error.message
    });
  }
});

// Récupérer les rendez-vous de l'utilisateur connecté
router.get('/user', verifyToken, async (req, res) => {
  try {
    console.log('🔍 Récupération des rendez-vous de l\'utilisateur');
    
    // Récupérer l'ID de l'utilisateur à partir de son email
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const userId = userResult.rows[0].id;
    
    // Récupérer les rendez-vous de l'utilisateur avec les informations des créneaux horaires
    const result = await db.query(`
      SELECT r.*, ts.start_datetime, ts.end_datetime
      FROM rdv r
      JOIN time_slots ts ON r.time_slot_id = ts.id
      WHERE r.user_id = $1
      ORDER BY ts.start_datetime DESC
    `, [userId]);
    
    res.json({
      success: true,
      appointments: result.rows
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous',
      error: error.message
    });
  }
});

// Annuler un rendez-vous (utilisateur authentifié)
router.put('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Tentative d'annulation du rendez-vous ${id}`);
    
    // Récupérer l'ID de l'utilisateur
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const userId = userResult.rows[0].id;
    
    // Vérifier que le rendez-vous existe et appartient à l'utilisateur
    const rdvResult = await db.query(
      'SELECT r.*, ts.id as time_slot_id FROM rdv r JOIN time_slots ts ON r.time_slot_id = ts.id WHERE r.id = $1 AND r.user_id = $2',
      [id, userId]
    );
    
    if (rdvResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé ou vous n\'êtes pas autorisé à l\'annuler'
      });
    }
    
    const rdv = rdvResult.rows[0];
    const timeSlotId = rdv.time_slot_id;
    
    // Vérifier que le rendez-vous n'est pas déjà annulé ou terminé
    if (rdv.status === 'canceled') {
      return res.status(400).json({
        success: false,
        message: 'Ce rendez-vous est déjà annulé'
      });
    }
    
    if (rdv.status === 'done') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler un rendez-vous déjà terminé'
      });
    }
    
    // Démarrer une transaction
    await db.query('BEGIN');
    
    try {
      // Utiliser 'canceled' au lieu de 'cancelled' (orthographe américaine)
      await db.query(
        'UPDATE rdv SET status = $1 WHERE id = $2',
        ['canceled', id]
      );
      
      // Remettre le créneau horaire comme disponible
      await db.query(
        'UPDATE time_slots SET status = $1 WHERE id = $2',
        ['available', timeSlotId]
      );
      
      // Envoi d'un email à l'admin pour l'informer de l'annulation
      try {
        // Récupérer les informations complètes de l'utilisateur
        const userQuery = await db.query('SELECT nom, prenom FROM users WHERE id = $1', [userId]);
        const user = userQuery.rows[0];

        // Récupérer les informations du créneau pour l'email
        const timeSlotQuery = await db.query('SELECT start_datetime FROM time_slots WHERE id = $1', [timeSlotId]);
        const startDate = new Date(timeSlotQuery.rows[0].start_datetime);
        const formattedDate = startDate.toLocaleDateString('fr-FR', { 
          day: '2-digit', month: '2-digit', year: 'numeric' 
        });
        const formattedTime = startDate.toLocaleTimeString('fr-FR', { 
          hour: '2-digit', minute: '2-digit' 
        });

        // Préparer les données pour le template
        const emailData = {
          userName: `${user.prenom} ${user.nom}`,
          type: rdv.type === 'tel' ? 'téléphonique' : 'stratégique',
          date: formattedDate,
          time: formattedTime
        };

        // Envoyer l'email à l'admin
        await sendEmail(
          process.env.GMAIL_USER,
          `Annulation d'un rendez-vous ${emailData.type}`,
          adminAppointmentCanceledTemplate(emailData)
        );

        console.log(`📧 Email de notification d'annulation envoyé à l'administrateur`);
      } catch (emailError) {
        // Ne pas bloquer le processus si l'envoi d'email échoue
        console.error('❌ Erreur lors de l\'envoi de l\'email d\'annulation:', emailError);
      }
      
      await db.query('COMMIT');
      
      console.log('✅ Rendez-vous annulé avec succès');
      res.json({
        success: true,
        message: 'Rendez-vous annulé avec succès'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation du rendez-vous',
      error: error.message
    });
  }
});

// Annuler un rendez-vous (admin uniquement)
router.put('/:id/cancel-admin', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Tentative d'annulation du rendez-vous ${id} par un administrateur`);
    
    // Vérifier que le rendez-vous existe
    const rdvResult = await db.query(
      'SELECT r.*, ts.id as time_slot_id FROM rdv r JOIN time_slots ts ON r.time_slot_id = ts.id WHERE r.id = $1',
      [id]
    );
    
    if (rdvResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }
    
    const rdv = rdvResult.rows[0];
    const timeSlotId = rdv.time_slot_id;
    
    // Vérifier que le rendez-vous n'est pas déjà annulé ou terminé
    if (rdv.status === 'canceled') {
      return res.status(400).json({
        success: false,
        message: 'Ce rendez-vous est déjà annulé'
      });
    }
    
    if (rdv.status === 'done') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler un rendez-vous déjà terminé'
      });
    }
    
    // Démarrer une transaction
    await db.query('BEGIN');
    
    try {
      // Mettre à jour le statut du rendez-vous
      await db.query(
        'UPDATE rdv SET status = $1 WHERE id = $2',
        ['canceled', id]
      );
      
      // Remettre le créneau horaire comme disponible
      await db.query(
        'UPDATE time_slots SET status = $1 WHERE id = $2',
        ['available', timeSlotId]
      );
      
      await db.query('COMMIT');
      
      console.log('✅ Rendez-vous annulé avec succès par un administrateur');
      res.json({
        success: true,
        message: 'Rendez-vous annulé avec succès'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation du rendez-vous',
      error: error.message
    });
  }
});

// ✨ NOUVEAU: Créer un rendez-vous pour un utilisateur (admin uniquement)
router.post('/admin/create', verifyToken, isAdmin, async (req, res) => {
  try {
    const { user_id, type, start_datetime, end_datetime } = req.body;
    
    console.log(`📅 Admin créant un RDV (${type}) pour user ${user_id}: ${start_datetime} - ${end_datetime}`);
    
    // 1. Vérifier les données requises
    if (!user_id || !type || !start_datetime || !end_datetime) {
      return res.status(400).json({
        success: false,
        message: 'User ID, type, date de début et date de fin sont requis'
      });
    }

    // Vérification que la date de fin est après la date de début
    if (new Date(end_datetime) <= new Date(start_datetime)) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être postérieure à la date de début'
      });
    }
    
    // 2. Vérifier que l'utilisateur existe
    const userResult = await db.query(
      'SELECT id, nom, prenom, email FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    const user = userResult.rows[0];

    // Démarrer une transaction
    await db.query('BEGIN');
    
    try {
      // 3. Créer un créneau horaire directement avec le statut 'booked'
      // On pourrait aussi chercher un créneau existant mais la création directe est plus simple ici
      const timeSlotResult = await db.query(
        `INSERT INTO time_slots (start_datetime, end_datetime, status, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [start_datetime, end_datetime, 'booked', type]
      );
      const timeSlotId = timeSlotResult.rows[0].id;
      
      // 4. Créer le rendez-vous
      const rdvResult = await db.query(
        `INSERT INTO rdv (user_id, time_slot_id, type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [user_id, timeSlotId, type, 'scheduled']
      );
      const newAppointment = rdvResult.rows[0];
      
      // 5. Mettre à jour la progression de l'utilisateur si nécessaire
      if (type === 'tel') {
        await db.query(
          'UPDATE profiles SET progression_rdv_phone = 100 WHERE user_id = $1',
          [user_id]
        );
      } else if (type === 'strat') {
        await db.query(
          'UPDATE profiles SET progression_rdv_strategy = 100 WHERE user_id = $1',
          [user_id]
        );
      }
      
      await db.query('COMMIT');
      
      // Envoi d'un email de confirmation à l'utilisateur
      try {
        const startDate = new Date(start_datetime);
        const formattedDate = startDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedTime = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        const emailData = {
          userName: `${user.prenom} ${user.nom}`,
          date: formattedDate,
          time: formattedTime
        };
        
        let emailTemplate;
        let emailSubject;
        
        if (type === 'tel') {
          emailTemplate = phoneAppointmentTemplate(emailData);
          emailSubject = 'Confirmation de votre rendez-vous téléphonique';
        } else if (type === 'strat') {
          emailTemplate = strategyAppointmentTemplate(emailData);
          emailSubject = 'Confirmation de votre rendez-vous stratégique';
        }
        
        if (emailTemplate) {
          await sendEmail(user.email, emailSubject, emailTemplate);
          console.log(`📧 Email de confirmation (admin créé) envoyé à ${user.email}`);
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation (admin créé):', emailError);
      }
      
      console.log('✅ Rendez-vous créé avec succès par l\'admin');
      // 6. Renvoyer la réponse
      res.status(201).json({
        success: true,
        message: 'Rendez-vous créé avec succès par l\'administrateur',
        appointment: newAppointment
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error; // Laisse le gestionnaire d'erreur global attraper
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création du rendez-vous par l\'admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rendez-vous',
      error: error.message
    });
  }
});

module.exports = router;
