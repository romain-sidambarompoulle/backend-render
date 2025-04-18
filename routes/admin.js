const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const db = require('../db');
const bcrypt = require('bcryptjs');
const { RevokedToken } = require('../models/RevokedToken');
const jwt = require('jsonwebtoken');

console.log('Module admin.js chargé!');

// Route pour vérifier l'authentification admin
router.get('/users/check', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès non autorisé' });
  }
  res.json({ success: true });
});

// Route pour les statistiques du dashboard admin
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role != 'admin') as "totalUsers",
        (SELECT COUNT(*) FROM formulaires) as "totalForms",
        (SELECT COUNT(*) FROM documents) as "totalDocuments",
        (SELECT COUNT(*) FROM rdv) as "totalAppointments"
    `);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer tous les utilisateurs
router.get('/users', function(req, res, next) {
  console.log('PRE-HANDLER: Route /api/admin/users appelée');
  next();
}, verifyToken, isAdmin, async (req, res) => {
  console.log('⚙️ Exécution de la requête SQL...');
  try {
    const result = await db.query(`
      SELECT u.id, u.email, u.nom, u.prenom, u.role, u.created_at,
             p.progression_profile, p.progression_formulaire
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.role != 'admin'
      ORDER BY u.created_at DESC
    `);
    
    console.log('📊 Résultat de la requête:', result);
    console.log('👥 Utilisateurs trouvés:', result.rows);
    
    // Au cas où result.rows est undefined ou null
    const users = result.rows || [];
    
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('❌ Erreur SQL:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
  }
});

// Route pour ajouter un utilisateur via l'interface admin
router.get('/users/add', verifyToken, isAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Formulaire de création d\'utilisateur'
  });
});

// Récupérer les détails d'un utilisateur
router.get('/users/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.*, p.*, 
        (SELECT json_agg(d.*) FROM documents d WHERE d.user_id = u.id) as documents,
        (SELECT json_agg(f.*) FROM formulaires f WHERE f.user_id = u.id) as formulaires,
        (SELECT json_agg(r.*) FROM rdv r WHERE r.user_id = u.id) as rendez_vous
      FROM users u 
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [req.params.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    res.json({
      success: true,
      userData: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur détails utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour modifier un utilisateur
router.put('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE users 
       SET nom = $1, prenom = $2, role = $3
       WHERE id = $4 RETURNING *`, 
      [req.body.nom, req.body.prenom, req.body.role, req.params.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    res.json({ success: true, message: 'Utilisateur modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification utilisateur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour supprimer un utilisateur
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`🗑️ Tentative de suppression de l'utilisateur ${userId}`);
    
    // Commencer une transaction pour assurer l'intégrité des données
    await db.query('BEGIN');
    
    // 1. Supprimer d'abord les données associées (dans cet ordre)
    console.log('Suppression des rendez-vous...');
    await db.query('DELETE FROM rdv WHERE user_id = $1', [userId]);
    
    console.log('Suppression des formulaires...');
    await db.query('DELETE FROM formulaires WHERE user_id = $1', [userId]);
    
    console.log('Suppression des documents...');
    await db.query('DELETE FROM documents WHERE user_id = $1', [userId]);
    
    console.log('Suppression du profil...');
    await db.query('DELETE FROM profiles WHERE user_id = $1', [userId]);
    
    // 2. Enfin, supprimer l'utilisateur
    console.log('Suppression de l\'utilisateur...');
    const result = await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    if (result.rowCount === 0) {
      await db.query('ROLLBACK'); // Annuler la transaction
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    // Valider la transaction
    await db.query('COMMIT');
    
    console.log('✅ Utilisateur et données associées supprimés avec succès');
    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    // En cas d'erreur, annuler la transaction
    await db.query('ROLLBACK');
    
    console.error('❌ Erreur suppression utilisateur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la suppression', 
      error: error.message 
    });
  }
});

// Route pour créer un utilisateur (à ajouter)
router.post('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('📝 Tentative de création d\'un utilisateur par l\'admin');
    const { email, password, nom, prenom, role = 'visitor' } = req.body;
    
    // Vérification si l'utilisateur existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Cet email est déjà utilisé' 
      });
    }

    // Création de l'utilisateur
    const newUser = await User.create(email, password, nom, prenom, role);
    
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      user: {
        id: newUser.id,
        email: newUser.email,
        nom: newUser.nom,
        prenom: newUser.prenom,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur création utilisateur:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de l\'utilisateur',
      error: error.message
    });
  }
});

// Route pour créer/modifier un formulaire pour un utilisateur (POST - crée un nouveau ou remplace potentiellement)
router.post('/users/:userId/formulaire', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { donnees } = req.body;

    // Vérifier si l'utilisateur existe
    const userExists = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Insérer ou mettre à jour le formulaire (Cette route POST gère la création, pas la MAJ spécifique)
    // Note: La logique ici pourrait être revue si on veut strictement séparer POST (création) et PUT (MAJ)
    const result = await db.query(
      `INSERT INTO formulaires (user_id, type, donnees)
       VALUES ($1, 'situation', $2)
       ON CONFLICT (user_id, type) DO UPDATE SET donnees = EXCLUDED.donnees, updated_at = NOW()
       RETURNING *`,
      [userId, donnees]
    );

    // Mettre à jour la progression
    await db.query(
      `UPDATE profiles SET progression_formulaire = 100 WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Formulaire enregistré avec succès',
      formulaire: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur enregistrement formulaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du formulaire',
      error: error.message
    });
  }
});

// ✨ NOUVELLE ROUTE : Mettre à jour un formulaire spécifique (PUT) ✨
router.put('/users/:userId/formulaire/:formulaireId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, formulaireId } = req.params;
    const { donnees } = req.body;

    console.log(`🔄 Tentative de mise à jour du formulaire ${formulaireId} pour l'utilisateur ${userId}`);
    console.log('Données reçues:', donnees);

    // Vérifier que les données sont présentes
    if (!donnees) {
        return res.status(400).json({ success: false, message: 'Les données du formulaire sont requises' });
    }

    // Vérifier si le formulaire existe et appartient bien à l'utilisateur
    const checkResult = await db.query(
      'SELECT * FROM formulaires WHERE id = $1 AND user_id = $2',
      [formulaireId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Formulaire non trouvé ou n\'appartient pas à cet utilisateur'
      });
    }

    // Mettre à jour les données du formulaire
    const updateResult = await db.query(
      `UPDATE formulaires
       SET donnees = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [donnees, formulaireId] // Note: 'donnees' doit être un objet JSON ou une chaîne JSON valide
    );

    console.log('✅ Formulaire mis à jour avec succès');
    res.json({
      success: true,
      message: 'Formulaire mis à jour avec succès',
      formulaire: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du formulaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du formulaire',
      error: error.message
    });
  }
});

// Route pour supprimer un formulaire spécifique
router.delete('/users/:userId/formulaire/:formulaireId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, formulaireId } = req.params;
    console.log(`🗑️ Tentative de suppression du formulaire ${formulaireId} pour l'utilisateur ${userId}`);

    // Vérifier si le formulaire existe et appartient à l'utilisateur
    const checkResult = await db.query(
      'SELECT * FROM formulaires WHERE id = $1 AND user_id = $2',
      [formulaireId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Formulaire non trouvé ou n\'appartient pas à cet utilisateur'
      });
    }

    // Supprimer le formulaire
    await db.query('DELETE FROM formulaires WHERE id = $1', [formulaireId]);

    // Si c'était le dernier formulaire, mettre à jour la progression
    const remainingForms = await db.query(
      'SELECT COUNT(*) FROM formulaires WHERE user_id = $1',
      [userId]
    );

    if (parseInt(remainingForms.rows[0].count) === 0) {
      await db.query(
        'UPDATE profiles SET progression_formulaire = 0 WHERE user_id = $1',
        [userId]
      );
    }

    res.json({
      success: true,
      message: 'Formulaire supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression formulaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du formulaire',
      error: error.message
    });
  }
});

// Ajoutez cette route tout en haut, avant les autres
// ✨ CONDITIONNEL: Uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  router.get('/simple-test', (req, res) => {
    console.log('🧪 Simple test route called!'); // Peut rester console.log car la route entière est conditionnelle
    res.json({ success: true, message: 'Simple test route works!' });
  });
}

// ==================== ROUTES MESSAGES CHAT ====================

// ✨ NOUVEAU: Récupérer tous les messages du chat (Admin)
router.get('/messages', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM messages ORDER BY created_at DESC'
    );
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('❌ Erreur récupération messages admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ✨ NOUVEAU: Récupérer le nombre de messages non lus (Admin)
router.get('/messages/unread-count', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE read = FALSE'
    );
    const count = result.rows[0]?.count || 0;
    res.json({ success: true, unreadCount: parseInt(count) });
  } catch (error) {
    console.error('❌ Erreur récupération compte messages non lus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ✨ NOUVEAU: Mettre à jour un message (Admin) - Contenu et statut lu/non lu
router.put('/messages/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, read } = req.body; // Accepte content et/ou read

    if (content === undefined && read === undefined) {
      return res.status(400).json({ success: false, message: 'Contenu ou statut de lecture requis pour la mise à jour.' });
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      values.push(content);
      paramIndex++;
    }

    if (read !== undefined) {
      updateFields.push(`read = $${paramIndex}`);
      values.push(read);
      paramIndex++;
    }
     updateFields.push(`updated_at = NOW()`); // Toujours mettre à jour updated_at

    values.push(id); // ID pour la clause WHERE

    const query = `UPDATE messages SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    res.json({ success: true, message: 'Message mis à jour', updatedMessage: result.rows[0] });
  } catch (error) {
    console.error('❌ Erreur mise à jour message admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ✨ NOUVEAU: Supprimer un message (Admin)
router.delete('/messages/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM messages WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Message non trouvé' });
    }

    res.json({ success: true, message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression message admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ✨ NOUVELLE ROUTE: Changer le mot de passe de l'admin connecté
router.put('/change-password', verifyToken, isAdmin, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    const adminEmail = req.user.userId; // L'email de l'admin connecté

    // Vérifier que les champs requis sont présents
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({
        success: false,
        message: "L'ancien et le nouveau mot de passe sont requis."
      });
    }

    // Récupérer l'admin via son email
    const adminUser = await User.findByEmail(adminEmail);
    if (!adminUser) {
      // Ne devrait pas arriver si verifyToken fonctionne, mais sécurité supplémentaire
      return res.status(404).json({
        success: false,
        message: 'Administrateur non trouvé.'
      });
    }

    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(ancienMotDePasse, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Ancien mot de passe incorrect.'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);

    // Mettre à jour le mot de passe dans la base de données
    await db.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, adminEmail]
    );

    // Révoquer les tokens actuels pour forcer une reconnexion (sécurité)
    const accessToken = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;

    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.exp) {
          await RevokedToken.revokeToken(
            accessToken,
            adminEmail,
            'access',
            new Date(decoded.exp * 1000)
          );
        }
      } catch (e) { console.error("Erreur révocation access token admin:", e); }
    }

    if (refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.exp) {
          await RevokedToken.revokeToken(
            refreshToken,
            adminEmail,
            'refresh',
            new Date(decoded.exp * 1000)
          );
        }
      } catch (e) { console.error("Erreur révocation refresh token admin:", e); }
    }

    // Effacer les cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    console.log(`✅ Mot de passe de l'administrateur ${adminEmail} modifié avec succès.`);
    res.json({
      success: true,
      message: 'Mot de passe administrateur modifié avec succès. Veuillez vous reconnecter.'
    });

  } catch (error) {
    console.error('❌ Erreur lors du changement de mot de passe administrateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de mot de passe.'
    });
  }
});

// ✨ NOUVELLE ROUTE: Activer/Mettre à jour une visio pour un utilisateur
router.post('/visio', verifyToken, isAdmin, async (req, res) => {
  try {
    const { user_id, visio_url } = req.body;

    // 1. Vérifier les données requises
    if (!user_id || !visio_url) {
      return res.status(400).json({
        success: false,
        message: "L'ID de l'utilisateur et l'URL de la visio sont requis."
      });
    }

    // 2. Vérifier que l'utilisateur existe (optionnel mais recommandé)
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé."
      });
    }

    // 3. Démarrer une transaction pour assurer l'atomicité
    await db.query('BEGIN');

    // 4. Désactiver tous les liens actifs précédents pour cet utilisateur
    const deactivateQuery = `
      UPDATE visio_links SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND is_active = TRUE;
    `;
    await db.query(deactivateQuery, [user_id]);

    // 5. Insérer le nouveau lien actif
    const insertQuery = `
      INSERT INTO visio_links (user_id, visio_url, is_active, created_at, updated_at)
      VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await db.query(insertQuery, [user_id, visio_url]);

    // 6. Valider la transaction
    await db.query('COMMIT');

    console.log(`✅ Visio activée/mise à jour pour l'utilisateur ${user_id} avec l'URL: ${visio_url}`);
    res.json({ success: true, message: 'Lien de visioconférence activé avec succès pour l\'utilisateur.' });

  } catch (error) {
    // En cas d'erreur, annuler la transaction
    await db.query('ROLLBACK');
    console.error('❌ Erreur lors de l\'activation de la visio:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'activation de la visio.' });
  }
});

// ✨ NOUVELLE ROUTE: Désactiver le lien visio actif pour un utilisateur
router.delete('/visio/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🚫 Tentative de désactivation du lien visio actif pour l'utilisateur ${userId}`);

    // Mettre à jour le statut is_active à FALSE pour tous les liens de cet utilisateur
    // (même s'il ne devrait y en avoir qu'un actif à la fois avec la logique précédente)
    const updateResult = await db.query(
      `UPDATE visio_links 
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND is_active = TRUE`, // Cible uniquement les liens actifs
      [userId]
    );

    // Vérifier si une ligne a été mise à jour
    if (updateResult.rowCount > 0) {
      console.log(`✅ Lien(s) visio désactivé(s) pour l'utilisateur ${userId}`);
      res.json({ success: true, message: 'Lien visioconférence désactivé avec succès.' });
    } else {
      console.log(`ℹ️ Aucun lien visio actif trouvé à désactiver pour l'utilisateur ${userId}`);
      res.json({ success: true, message: 'Aucun lien visioconférence actif à désactiver pour cet utilisateur.' }); // Toujours succès, car l'état désiré est atteint
    }
  } catch (error) {
    console.error('❌ Erreur lors de la désactivation de la visio:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur lors de la désactivation de la visio.' });
  }
});

module.exports = router;
