const db = require('../db'); // Importer le pool de connexion

/**
 * Récupère l'ID du premier administrateur trouvé dans la base.
 * Utilisé comme point de contact unique pour les messages internes.
 * @returns {Promise<number>} - ID de l'administrateur.
 * @throws {Error} Si aucun administrateur n'est trouvé.
 */
async function getSharedAdminId() {
    const adminResult = await db.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin']);
    if (adminResult.rows.length === 0) {
        const error = new Error('Admin recipient/sender not found');
        error.statusCode = 500; // Erreur serveur car un admin devrait exister
        throw error;
    }
    console.log(`Service: Using shared adminId=${adminResult.rows[0].id}`);
    return adminResult.rows[0].id;
}

/**
 * Récupère la liste paginée des messages d'une conversation entre un utilisateur et un admin.
 * @param {number} userId - ID de l'utilisateur.
 * @param {number} adminId - ID de l'administrateur.
 * @param {number} limit - Nombre de messages par page.
 * @param {number} offset - Décalage pour la pagination.
 * @returns {Promise<{messages: Array, totalMessages: number}>} - Liste des messages et nombre total.
 */
async function getMessagesByConversation(userId, adminId, limit, offset) {
    console.log(`Service: Fetching conversation userId=${userId}, adminId=${adminId}, limit=${limit}, offset=${offset}`);
    // Récupérer le nombre total de messages
    const totalCountResult = await db.query(`
        SELECT COUNT(*) FROM internal_messages
        WHERE (sender_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND sender_id = $2)
    `, [userId, adminId]);
    const totalMessages = parseInt(totalCountResult.rows[0].count, 10);

    // Récupérer les messages paginés, les plus récents en premier
    const messagesResult = await db.query(`
        SELECT * FROM internal_messages
        WHERE (sender_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND sender_id = $2)
        ORDER BY created_at DESC -- Trier par DESC pour obtenir les plus récents
        LIMIT $3 OFFSET $4
    `, [userId, adminId, limit, offset]);

    return {
        messages: messagesResult.rows,
        totalMessages: totalMessages
    };
}

/**
 * ✨ Renommée: Marque les messages envoyés par un utilisateur spécifique à un admin comme lus.
 * @param {number} userId - ID de l'utilisateur (expéditeur).
 * @param {number} adminId - ID de l'administrateur (destinataire).
 * @returns {Promise<{rowCount: number}>} - Nombre de lignes mises à jour.
 */
async function markUserMessagesAsReadByAdmin(userId, adminId) {
    console.log(`Service: Marking user messages as read by admin. userId=${userId}, adminId=${adminId}`);
    // Marque les messages où l'admin est le destinataire, l'user est l'expéditeur (is_admin=FALSE) et non lus
    const result = await db.query(`
        UPDATE internal_messages
        SET read = true
        WHERE receiver_id = $1 -- Admin
          AND sender_id = $2   -- User
          AND is_admin = FALSE
          AND read = false;
    `, [adminId, userId]); // Attention à l'ordre des IDs ici
    console.log(`Service: Marked ${result.rowCount} user messages as read by admin ${adminId}.`);
    return { rowCount: result.rowCount };
}

/**
 * ✨ Renommée: Marque les messages envoyés par l'admin à un user comme lus.
 * @param {number} userId - ID de l'utilisateur (destinataire).
 * @param {number} adminId - ID de l'administrateur (expéditeur).
 * @returns {Promise<{rowCount: number}>} - Nombre de lignes mises à jour.
 */
async function markAdminMessagesAsReadByUser(userId, adminId) {
    console.log(`Service: Marking admin messages as read by user. userId=${userId}, adminId=${adminId}`);
    // Met à jour les messages où l'utilisateur est le destinataire, l'admin est l'expéditeur (is_admin=TRUE) et qui ne sont pas lus
    const result = await db.query(`
        UPDATE internal_messages
        SET read = true
        WHERE receiver_id = $1 -- User
          AND sender_id = $2   -- Admin
          AND is_admin = TRUE
          AND read = false;
    `, [userId, adminId]); // Attention à l'ordre
    console.log(`Service: Marked ${result.rowCount} admin messages as read by user ${userId}.`);
    return { rowCount: result.rowCount };
}

/**
 * Récupère la liste des utilisateurs ayant échangé des messages avec l'admin,
 * ou de tous les utilisateurs non-admin, incluant le nombre de messages non lus par l'admin.
 * @param {number} adminIdToFetchFor - ID de l'administrateur connecté.
 * @returns {Promise<Array>} - Liste des utilisateurs avec leurs informations et le compte non lu.
 */
async function getUsersWithMessages(adminIdToFetchFor) {
    console.log(`Service: Fetching ALL non-admin users for adminId=${adminIdToFetchFor}`);
    const result = await db.query(`
      SELECT
          u.id AS user_id,
          u.nom,
          u.prenom,
          u.email,
          (SELECT MAX(m.created_at)
           FROM internal_messages m
           WHERE (m.sender_id = u.id AND m.receiver_id = $1)
              OR (m.receiver_id = u.id AND m.sender_id = $1)
          ) AS last_message_date, -- Sera NULL si aucune conversation
          (SELECT COUNT(*)
           FROM internal_messages m_unread
           WHERE m_unread.receiver_id = $1
             AND m_unread.sender_id = u.id
             AND m_unread.is_admin = FALSE
             AND m_unread.read = FALSE
          )::integer AS unread_count, -- Sera 0 si aucune conversation ou aucun non lu par l'admin
          last_admin_msg.created_at AS last_admin_message_sent_at,
          last_admin_msg.read AS last_admin_message_read_status
      FROM users u
      LEFT JOIN LATERAL (
          SELECT m_admin.created_at, m_admin.read
          FROM internal_messages m_admin
          WHERE m_admin.sender_id = $1 -- Message de l'admin
            AND m_admin.receiver_id = u.id -- Vers cet utilisateur
            AND m_admin.is_admin = TRUE
          ORDER BY m_admin.created_at DESC
          LIMIT 1
      ) last_admin_msg ON true -- Toujours joindre, mais la jointure peut ne renvoyer aucune ligne
      WHERE u.role != 'admin' -- Sélectionne tous les utilisateurs non-admin
      ORDER BY unread_count DESC, last_message_date DESC NULLS LAST, u.nom;
    `, [adminIdToFetchFor]);

    console.log(`Service: Found ${result.rows.length} non-admin users.`);
    return result.rows;
}

/**
 * Enregistre un nouveau message dans la base de données.
 * @param {number} senderId - ID de l'expéditeur.
 * @param {number} receiverId - ID du destinataire.
 * @param {string} content - Contenu du message.
 * @param {boolean} isAdmin - True si le message est envoyé par un admin.
 * @returns {Promise<object>} - Le message inséré.
 */
async function sendMessage(senderId, receiverId, content, isAdmin) {
    console.log(`Service: Sending message senderId=${senderId}, receiverId=${receiverId}, isAdmin=${isAdmin}`);
    const insertResult = await db.query(
      `INSERT INTO internal_messages (sender_id, receiver_id, content, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [senderId, receiverId, content.trim(), isAdmin]
    );
    if (insertResult.rows.length === 0) {
        throw new Error('Failed to insert message');
    }
    return insertResult.rows[0];
}

/**
 * Supprime tous les messages d'une conversation entre un utilisateur et l'admin partagé.
 * @param {number} userId - ID de l'utilisateur.
 * @param {number} adminId - ID de l'administrateur partagé.
 * @returns {Promise<{deletedCount: number}>} - Nombre de messages supprimés.
 * @throws {Error} Si la suppression échoue.
 */
async function deleteConversation(userId, adminId) {
    console.log(`Service: Deleting conversation userId=${userId}, adminId=${adminId}`);
    const deleteResult = await db.query(`
        DELETE FROM internal_messages
        WHERE (sender_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND sender_id = $2)
    `, [userId, adminId]);

    // rowCount contient le nombre de lignes affectées par la requête DELETE
    console.log(`Service: Deleted ${deleteResult.rowCount} messages for conversation.`);
    return { deletedCount: deleteResult.rowCount };
}

// ✨ NOUVEAU: Compte les messages non lus pour l'admin partagé.
async function getUnreadAdminMessagesCount(adminId) {
    console.log(`Service: Counting unread messages for adminId=${adminId}`);
    const countResult = await db.query(`
        SELECT COUNT(*) 
        FROM internal_messages 
        WHERE receiver_id = $1 
        AND is_admin = FALSE 
        AND read = FALSE
    `, [adminId]);
    const unreadCount = parseInt(countResult.rows[0].count, 10);
    return unreadCount;
}

// ✨ NOUVEAU: Compte les messages non lus pour un utilisateur spécifique.
async function getUnreadUserMessagesCount(userId) {
    console.log(`Service: Counting unread messages for userId=${userId}`);
    const countResult = await db.query(`
        SELECT COUNT(*) 
        FROM internal_messages 
        WHERE receiver_id = $1 
        AND is_admin = TRUE 
        AND read = FALSE
    `, [userId]);
    const unreadCount = parseInt(countResult.rows[0].count, 10);
    return unreadCount;
}

module.exports = {
  getSharedAdminId,
  getMessagesByConversation,
  markUserMessagesAsReadByAdmin,
  getUsersWithMessages,
  sendMessage,
  deleteConversation,
  getUnreadAdminMessagesCount,
  getUnreadUserMessagesCount,
  markAdminMessagesAsReadByUser
};