const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth'); // Ajuster le chemin si nécessaire
const db = require('../../db'); // Garder pour getAdminId si besoin, ou déplacer getAdminId dans le service

// Importer le service
const internalMessageService = require('../../services/internalMessageService'); 

// GET /api/admin/messages/users - Utilise le service AVEC l'ID partagé
router.get('/users', verifyToken, isAdmin, async (req, res) => {
    try {
        // Utiliser la fonction partagée pour obtenir l'ID admin (ex: 6)
        const sharedAdminId = await internalMessageService.getSharedAdminId();
        // Appeler getUsersWithMessages en lui passant cet ID partagé
        const users = await internalMessageService.getUsersWithMessages(sharedAdminId); 
        console.log(`Route: Found ${users.length} users with messages for shared adminId=${sharedAdminId}.`);
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('❌ Route Error /users:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
    }
});

// ✨ NOUVEAU: GET /api/admin/messages/unread-count - Compter les messages non lus pour l'admin
router.get('/unread-count', verifyToken, isAdmin, async (req, res) => {
    try {
        // ✨ Re-activer l'appel au service
        const sharedAdminId = await internalMessageService.getSharedAdminId();
        const unreadCount = await internalMessageService.getUnreadAdminMessagesCount(sharedAdminId);

        console.log(`Route Admin: Found ${unreadCount} unread internal messages for adminId=${sharedAdminId}.`);
        res.json({ success: true, unreadCount: unreadCount });

    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
    }
});

// GET /api/admin/messages/:userId - Utilise le service AVEC l'ID partagé
router.get('/:userId', verifyToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId, 10);
        // L'admin connecté (req.user.userId) n'est plus utilisé pour trouver l'ID admin de la conversation
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);

        if (isNaN(numericUserId) || isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
            return res.status(400).json({ success: false, message: "Paramètres invalides (userId, limit, offset)." });
        }

        // Utiliser la fonction partagée pour obtenir l'ID admin (ex: 6)
        const sharedAdminId = await internalMessageService.getSharedAdminId();

        console.log(`Route: Fetching conversation userId=${numericUserId} with sharedAdminId=${sharedAdminId}, offset=${offset}`);

        // Récupérer les informations de l'utilisateur (OK)
        const userInfoResult = await db.query('SELECT nom, prenom, email FROM users WHERE id = $1', [numericUserId]);
        const userInfo = userInfoResult.rows[0] || null;

        // Récupérer les messages via le service (utilise l'ID partagé)
        const { messages, totalMessages } = await internalMessageService.getMessagesByConversation(numericUserId, sharedAdminId, limit, offset);

        res.json({
            success: true,
            messages: messages,
            totalMessages: totalMessages,
            userInfo: userInfo
        });

    } catch (error) {
        console.error(`❌ Route Error /:userId GET:`, error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
    }
});

// POST /api/admin/messages/:userId - Utilise le service AVEC l'ID partagé comme expéditeur
router.post('/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    const receiverUserId = parseInt(req.params.userId, 10);
    // L'email de l'admin connecté (req.user.userId) n'est plus utilisé pour l'ID expéditeur

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Le contenu du message ne peut pas être vide.' });
    }
    if (isNaN(receiverUserId)) {
      return res.status(400).json({ success: false, message: 'ID utilisateur destinataire invalide.' });
    }

    // Utiliser la fonction partagée pour obtenir l'ID admin expéditeur (ex: 6)
    const senderAdminId = await internalMessageService.getSharedAdminId();

    // Optionnel: Vérifier l'existence de l'utilisateur (OK)
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [receiverUserId]);
    if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Utilisateur destinataire non trouvé.' });
    }

    // Envoyer le message via le service (l'expéditeur est l'ID partagé)
    const sentMessage = await internalMessageService.sendMessage(
        senderAdminId,
        receiverUserId,
        content,
        true // isAdmin = true
    );

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès à l\'utilisateur.',
      sentMessage: sentMessage
    });

  } catch (error) {
    console.error(`❌ Route Error /:userId POST:`, error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message ||'Une erreur est survenue lors de l\'envoi du message.' });
  }
});

/**
 * ✨ NOUVEAU: PUT /api/admin/messages/:userId/mark-read
 * @desc    Marque tous les messages envoyés par un utilisateur spécifique à l'admin comme lus.
 * @access  Privé (Admin)
 */
router.put('/:userId/mark-read', verifyToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId, 10);

        if (isNaN(numericUserId)) {
            return res.status(400).json({ success: false, message: "ID utilisateur invalide." });
        }

        const adminId = await internalMessageService.getSharedAdminId();

        console.log(`Route Admin PUT /:userId/mark-read: Marking user messages as read by admin. userId=${numericUserId}, adminId=${adminId}.`);
        const result = await internalMessageService.markUserMessagesAsReadByAdmin(numericUserId, adminId);

        res.json({ success: true, message: `${result.rowCount} message(s) de l'utilisateur marqué(s) comme lu(s).` });

    } catch (error) {
        console.error(`❌ Route Error PUT /:userId/mark-read:`, error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
    }
});

// DELETE /api/admin/messages/:userId - Supprime une conversation
router.delete('/:userId', verifyToken, isAdmin, async (req, res) => {
    try {
        const receiverUserId = parseInt(req.params.userId, 10);
        if (isNaN(receiverUserId)) {
            return res.status(400).json({ success: false, message: 'ID utilisateur invalide.' });
        }

        // Utiliser la fonction partagée pour obtenir l'ID admin (cible de la suppression avec l'user)
        const sharedAdminId = await internalMessageService.getSharedAdminId();

        // Appeler le service pour supprimer la conversation
        const result = await internalMessageService.deleteConversation(receiverUserId, sharedAdminId);

        res.json({
            success: true,
            message: `Conversation supprimée avec succès (${result.deletedCount} message(s) effacé(s)).`
        });

    } catch (error) {
        console.error(`❌ Route Error /:userId DELETE:`, error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Une erreur est survenue lors de la suppression de la conversation.' });
    }
});

module.exports = router;