const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const db = require('../../db'); // Utiliser le pool de connexion partagé

// GET /api/admin/chat-messages - Récupérer tous les messages anonymes
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        // Sélectionner depuis la table 'messages' utilisée par ChatWidget/chatRoutes.js
        const result = await db.query('SELECT * FROM messages ORDER BY created_at DESC');
        res.json({ success: true, messages: result.rows });
    } catch (error) {
        console.error('❌ Erreur récupération chat messages admin:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ✨ NOUVELLE ROUTE: GET /api/admin/chat-messages/unread-count - Compter les messages chat non lus
router.get('/unread-count', verifyToken, isAdmin, async (req, res) => {
    try {
        // Compter les messages dans la table 'messages' où 'read' est false
        const result = await db.query('SELECT COUNT(*) FROM messages WHERE read = FALSE');
        const unreadCount = parseInt(result.rows[0].count, 10);
        res.json({ success: true, unreadCount: unreadCount });
    } catch (error) {
        console.error('❌ Erreur récupération unread count chat messages admin:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/admin/chat-messages/:id - Mettre à jour un message (contenu ou statut lu)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { content, read } = req.body; // Accepter soit 'content' soit 'read'

    try {
        let query;
        let queryParams;
        let updatedFields = {};

        if (content !== undefined) {
            query = 'UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
            queryParams = [content, id];
            updatedFields = { content };
        } else if (read !== undefined) {
            query = 'UPDATE messages SET read = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
            queryParams = [read, id];
            updatedFields = { read };
        } else {
            return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour (content ou read).' });
        }

        const result = await db.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Message non trouvé.' });
        }

        // Important: Renommer la clé pour correspondre à ce que MessagesAdmin attendait
        res.json({ success: true, updatedMessage: result.rows[0] }); 

    } catch (error) {
        console.error(`❌ Erreur mise à jour chat message admin (ID: ${id}):`, error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour.' });
    }
});

// DELETE /api/admin/chat-messages/:id - Supprimer un message anonyme
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM messages WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Message non trouvé.' });
        }
        res.json({ success: true, message: 'Message supprimé.' });
    } catch (error) {
        console.error(`❌ Erreur suppression chat message admin (ID: ${id}):`, error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression.' });
    }
});


module.exports = router;