const express = require('express');
const router = express.Router();
// Assurez-vous que les chemins d'accès sont corrects par rapport à ce fichier
const { verifyToken } = require('../../middleware/auth'); 
const db = require('../../db'); 
// ✨ Importer TOUT le service
const internalMessageService = require('../../services/internalMessageService'); 

/**
 * @route   GET /api/user/messages
 * @desc    Récupérer la conversation paginée de l'utilisateur connecté
 * @access  Privé (Utilisateur connecté)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.userId;
    const userId = await getUserIdFromEmail(userEmail);
    const adminId = await internalMessageService.getSharedAdminId();

    const limit = parseInt(req.query.limit || '20', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
      return res.status(400).json({ success: false, message: "Paramètres invalides (limit, offset)." });
    }

    console.log(`Route User GET: Fetching conversation userId=${userId}, sharedAdminId=${adminId}, offset=${offset}`);

    const { messages, totalMessages } = await internalMessageService.getMessagesByConversation(
      userId,
      adminId,
      limit,
      offset
    );

    res.json({
      success: true,
      messages: messages,
      totalMessages: totalMessages
    });

  } catch (error) {
    console.error(`❌ Route Error GET /api/user/messages:`, error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
});

/**
 * @route   POST /api/user/messages
 * @desc    Permet à un utilisateur connecté d'envoyer un message interne à l'administrateur.
 * @access  Privé (Utilisateur connecté)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const senderEmail = req.user.userId;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Le contenu du message ne peut pas être vide.' });
    }

    const senderId = await getUserIdFromEmail(senderEmail);
    const receiverAdminId = await internalMessageService.getSharedAdminId();

    console.log(`Route User POST: Sending message from userId=${senderId} to sharedAdminId=${receiverAdminId}`);

    const sentMessage = await internalMessageService.sendMessage(
      senderId,
      receiverAdminId,
      content,
      false
    );

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès à l\'administrateur.',
      sentMessage: sentMessage
    });

  } catch (error) {
    console.error(`❌ Route Error POST /api/user/messages:`, error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Une erreur est survenue lors de l\'envoi du message.'
    });
  }
});

/**
 * @route   GET /api/user/messages/unread-count
 * @desc    Compter les messages non lus pour l'utilisateur connecté.
 * @access  Privé (Utilisateur connecté)
 */
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.userId;
    const userId = await getUserIdFromEmail(userEmail);
    const unreadCount = await internalMessageService.getUnreadUserMessagesCount(userId);
    console.log(`Route User GET: Found ${unreadCount} unread internal messages for userId=${userId}.`);
    res.json({ success: true, unreadCount: unreadCount });
  } catch (error) {
    console.error(`❌ Route Error GET /api/user/messages/unread-count:`, error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
});

/**
 * @route   PUT /api/user/messages/mark-read
 * @desc    Marque tous les messages envoyés par l'admin à l'utilisateur connecté comme lus.
 * @access  Privé (Utilisateur connecté)
 */
router.put('/mark-read', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.userId;
    const userId = await getUserIdFromEmail(userEmail);
    const adminId = await internalMessageService.getSharedAdminId();

    console.log(`Route User PUT /mark-read: Marking admin messages as read for userId=${userId} from adminId=${adminId}.`);
    const result = await internalMessageService.markAdminMessagesAsReadByUser(userId, adminId);

    res.json({ success: true, message: `${result.rowCount} message(s) marqué(s) comme lu(s).` });

  } catch (error) {
    console.error(`❌ Route Error PUT /api/user/messages/mark-read:`, error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
});

// Fonction utilitaire pour récupérer l'ID de l'utilisateur à partir de son email
// (peut être déplacée dans un fichier utils/authUtils.js si utilisée ailleurs)
const getUserIdFromEmail = async (userEmail) => {
  const userResult = await db.query('SELECT id FROM users WHERE email = $1', [userEmail]);
  if (userResult.rows.length === 0) {
    const error = new Error('User not found for email: ' + userEmail);
    error.statusCode = 404; // Not Found
    throw error;
  }
  return userResult.rows[0].id;
};

module.exports = router;