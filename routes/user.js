const express = require('express');
const router = express.Router();
const { User } = require('../models/User');  // Import de la classe User
const { verifyToken } = require('../middleware/auth');
const db = require('../db');
// Importer les modules nécessaires pour l'envoi d'emails
const { sendEmail } = require('../utils/mailer');
const { 
  userFormTemplate, 
  userFormUpdateTemplate 
} = require('../utils/emailTemplates');

// Route pour obtenir le profil
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.getFullProfile(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    res.json({ 
      success: true,
      profile: {
        informations: {
          telephone: user.telephone,
          adresse: user.adresse,
          dateNaissance: user.date_naissance,
          situationFamiliale: user.situation_familiale
        },
        user: {
          nom: user.nom,
          prenom: user.prenom,
          email: user.email
        },
        documents: user.documents || [],
        formulaires: user.formulaires || [],
        rdv: user.rendez_vous || [],
        progression: {
          profile: user.progression_profile,
          documents: user.progression_documents,
          formulaire: user.progression_formulaire,
          rdvPhone: user.progression_rdv_phone,
          rdvStrategy: user.progression_rdv_strategy
        }
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur' 
    });
  }
});

// Route pour mettre à jour les informations du profil
router.put('/profile/informations', verifyToken, async (req, res) => {
  try {
    console.log('Données reçues dans la route:', req.body);
    
    // Séparer les données utilisateur des données de profil
    const { nom, prenom, email, ...profileData } = req.body;
    
    // Mettre à jour les informations utilisateur si elles sont fournies
    if (nom || prenom || email) {
      await User.updateUserInfo(req.user.userId, { nom, prenom, email });
    }
    
    // Mettre à jour les informations de profil
    const updatedProfile = await User.updateProfile(req.user.userId, profileData);
    console.log('Profil mis à jour:', updatedProfile);

    // Récupérer les informations utilisateur mises à jour
    const updatedUser = await User.findByEmail(req.user.userId);

    // Structure TRÈS simple et claire
    res.json({
      success: true,
      profile: {
        ...updatedProfile,
        user: {
          nom: updatedUser.nom,
          prenom: updatedUser.prenom,
          email: updatedUser.email
        }
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// Ajouter un document
router.post('/documents', verifyToken, async (req, res) => {
  try {
    const document = await User.addDocument(req.user.userId, {
      nom: req.body.nom,
      type: req.body.type,
      url: req.body.url
    });

    res.json({ 
      success: true, 
      document 
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajout du document' });
  }
});

// Sauvegarder le formulaire
router.post('/formulaire', verifyToken, async (req, res) => {
  try {
    const formulaire = await User.saveFormulaire(req.user.userId, req.body);
    
    // Envoi d'email de confirmation
    try {
      // Récupérer des informations plus complètes sur l'utilisateur
      const userQuery = await db.query(
        'SELECT nom, prenom FROM users WHERE email = $1',
        [req.user.userId]
      );
      
      if (userQuery.rows.length > 0) {
        const user = userQuery.rows[0];
        
        // Préparer les données pour le template
        const emailData = {
          userName: `${user.prenom} ${user.nom}`,
          formType: 'Formulaire utilisateur',
          details: `Date de création: ${new Date().toLocaleDateString('fr-FR')}`,
        };
        
        // Envoyer l'email de confirmation
        await sendEmail(
          req.user.userId, 
          'Votre formulaire a bien été créé',
          userFormTemplate(emailData)
        );
        
        console.log(`📧 Email de confirmation de création envoyé à ${req.user.userId}`);

        // ✨ NOUVEAU: Envoyer un email à l'admin
        const adminHTML = `<p>Un utilisateur a créé un nouveau formulaire:</p>
          <ul>
            <li>Utilisateur: ${user.prenom} ${user.nom}</li>
            <li>Email: ${req.user.userId}</li>
            <li>Type: ${emailData.formType}</li>
            <li>Date: ${new Date().toLocaleDateString('fr-FR')}</li>
          </ul>`;
        await sendEmail(process.env.GMAIL_USER, 'Nouveau formulaire utilisateur créé', adminHTML);
        console.log(`📧 Email de notification envoyé à l'administrateur`);
      }
    } catch (emailError) {
      // Ne pas bloquer le processus si l'envoi d'email échoue
      console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
    }
    
    res.json({ 
      success: true, 
      formulaire 
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde du formulaire' });
  }
});

// Planifier un RDV
router.post('/rdv/:type', verifyToken, async (req, res) => {
  try {
    const type = req.params.type;
    if (!['telephone', 'strategie'].includes(type)) {
      return res.status(400).json({ message: 'Type de RDV invalide' });
    }

    const rdv = await User.planifierRdv(req.user.userId, type, req.body.date);
    res.json({ 
      success: true, 
      rdv 
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la planification du RDV' });
  }
});

// Route pour changer le mot de passe
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    
    // Vérifier que les champs requis sont présents
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({
        success: false,
        message: "L'ancien mot de passe et le nouveau mot de passe sont requis"
      });
    }

    // Récupérer l'utilisateur via son email
    const user = await User.findByEmail(req.user.userId);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Importer bcryptjs pour comparer et hasher les mots de passe
    const bcrypt = require('bcryptjs');
    
    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(ancienMotDePasse, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Ancien mot de passe incorrect"
      });
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, salt);

    // Mettre à jour le mot de passe dans la base de données
    await db.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, req.user.userId]
    );

    res.json({
      success: true,
      message: "Mot de passe mis à jour"
    });
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du changement de mot de passe"
    });
  }
});

// Route pour récupérer tous les formulaires de l'utilisateur
router.get('/formulaires', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.userId; // Ceci est en réalité l'email, pas l'ID
    
    // D'abord, récupérer l'ID utilisateur à partir de l'email
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await db.query(userQuery, [userEmail]);
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    const userId = userResult.rows[0].id;
    
    // Ensuite, récupérer les formulaires avec l'ID utilisateur
    const query = 'SELECT * FROM formulaires WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [userId]);
    
    // Vérifier si des formulaires ont été trouvés
    if (!result.rows || result.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Aucun formulaire trouvé pour cet utilisateur', 
        formulaires: [] 
      });
    }
    
    // Afficher la structure des données pour le débogage
    console.log('Structure du premier formulaire:', result.rows[0]);
    
    // Transformer les données JSON stockées dans chaque formulaire
    for (let i = 0; i < result.rows.length; i++) {
      // Vérifier si donnees est une chaîne qui doit être parsée
      if (result.rows[i].donnees && typeof result.rows[i].donnees === 'string') {
        try {
          // Vérifier s'il s'agit d'une chaîne qui ressemble à du JSON
          if (result.rows[i].donnees.startsWith('{') || result.rows[i].donnees.startsWith('[')) {
            result.rows[i].data = JSON.parse(result.rows[i].donnees);
          } else {
            // Si ce n'est pas du JSON valide, utiliser tel quel
            result.rows[i].data = result.rows[i].donnees;
          }
        } catch (e) {
          console.error('Erreur de parsing JSON pour le formulaire', result.rows[i].id, e);
          // Ne pas écraser les données existantes en cas d'erreur
        }
      } else if (result.rows[i].donnees) {
        // Si c'est déjà un objet, l'utiliser directement
        result.rows[i].data = result.rows[i].donnees;
      }
    }
    
    res.json({ success: true, formulaires: result.rows });
  } catch (error) {
    console.error('Erreur lors de la récupération des formulaires:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des formulaires' 
    });
  }
});

// Route pour mettre à jour un formulaire existant
router.put('/formulaire/:id', verifyToken, async (req, res) => {
  try {
    const formulaireId = req.params.id;
    const userEmail = req.user.userId; // C'est l'email, pas l'ID
    
    // Ajouter des logs pour le debugging
    console.log('PUT /api/user/formulaire/' + formulaireId);
    console.log('Token décodé:', req.user);
    console.log('Données reçues:', req.body);
    
    // D'abord, récupérer l'ID utilisateur à partir de l'email
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await db.query(userQuery, [userEmail]);
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }
    
    const userId = userResult.rows[0].id;
    const updatedData = req.body;
    
    // Vérifier si le formulaire existe et appartient à l'utilisateur
    const checkQuery = 'SELECT * FROM formulaires WHERE id = $1 AND user_id = $2';
    const result = await db.query(checkQuery, [formulaireId, userId]);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Formulaire non trouvé ou non autorisé' 
      });
    }
    
    // Examiner la structure de la table
    console.log('Structure du formulaire existant:', result.rows[0]);
    
    // Mettre à jour le formulaire - modifié pour utiliser "donnees" au lieu de "data"
    const updateQuery = 'UPDATE formulaires SET donnees = $1, updated_at = NOW() WHERE id = $2';
    await db.query(updateQuery, [JSON.stringify(updatedData), formulaireId]);
    
    // Envoi d'email de confirmation de mise à jour
    try {
      // Récupérer des informations plus complètes sur l'utilisateur
      const userDetailsQuery = await db.query(
        'SELECT nom, prenom FROM users WHERE email = $1',
        [userEmail]
      );
      
      if (userDetailsQuery.rows.length > 0) {
        const user = userDetailsQuery.rows[0];
        
        // Préparer les données pour le template
        const emailData = {
          userName: `${user.prenom} ${user.nom}`,
          formType: 'Formulaire utilisateur',
          details: `Mis à jour le: ${new Date().toLocaleDateString('fr-FR')}`,
        };
        
        // Utiliser le template spécifique pour les mises à jour
        await sendEmail(
          userEmail, 
          'Vos modifications ont été prises en compte ✏️',
          userFormUpdateTemplate(emailData)
        );
        
        console.log(`📧 Email de confirmation de mise à jour envoyé à ${userEmail}`);
      }
    } catch (emailError) {
      // Ne pas bloquer le processus si l'envoi d'email échoue
      console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
    }
    
    res.json({ success: true, message: 'Formulaire mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du formulaire:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour du formulaire' 
    });
  }
});

// ✨ NOUVELLE ROUTE : Récupérer le lien de visio actif pour l'utilisateur connecté
router.get('/visio', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.userId; // Email de l'utilisateur connecté
    console.log(`🔍 Recherche lien visio actif pour: ${userEmail}`);

    // 1. Trouver l'ID numérique de l'utilisateur via son email
    const userQuery = await db.query('SELECT id FROM users WHERE email = $1', [userEmail]);

    if (userQuery.rows.length === 0) {
      console.log(`🚫 Utilisateur non trouvé pour l'email: ${userEmail}`);
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé.'
      });
    }

    const userId = userQuery.rows[0].id;
    console.log(`👤 ID Utilisateur trouvé: ${userId}`);

    // 2. Rechercher un lien visio actif pour cet utilisateur
    const visioQuery = await db.query(
      'SELECT visio_url FROM visio_links WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    // 3. Vérifier si un lien actif a été trouvé
    if (visioQuery.rows.length > 0) {
      const activeLink = visioQuery.rows[0].visio_url;
      console.log(`✅ Lien visio actif trouvé pour ${userId}: ${activeLink}`);
      res.json({ success: true, visio_url: activeLink });
    } else {
      console.log(`ℹ️ Aucun lien visio actif trouvé pour ${userId}`);
      res.json({ success: false, message: 'Aucune visioconférence active pour le moment.' });
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération du lien visio:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération du lien visio.' });
  }
});

module.exports = router;