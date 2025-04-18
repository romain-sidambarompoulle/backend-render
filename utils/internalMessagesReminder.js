const db = require('../db'); // Assurez-vous que le chemin est correct
const { sendEmail } = require('./mailer');
const { internalMessageReminderTemplate } = require('./emailTemplates'); // Nous ajouterons ce template ensuite

/**
 * Trouve les messages internes envoyés par un admin, non lus par l'utilisateur depuis plus de 48h,
 * et envoie un email de rappel à chaque utilisateur concerné.
 */
async function sendUnreadMessageReminders() {
  console.log('🔍 Recherche des messages internes non lus depuis plus de 48h...');
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  try {
    // Récupérer les messages admin non lus (> 48h) et l'email/nom du destinataire
    const query = `
      SELECT
          im.id AS message_id,
          im.receiver_id,
          im.created_at,
          u.email AS receiver_email,
          u.nom AS receiver_name
      FROM
          internal_messages im
      JOIN
          users u ON im.receiver_id = u.id -- Assurez-vous que la table 'users' et les colonnes 'id', 'email', 'nom' existent
      WHERE
          im.is_admin = TRUE
          AND im.read = FALSE
          AND im.created_at < $1
      ORDER BY
          im.receiver_id, im.created_at;
    `;
    const { rows: messages } = await db.query(query, [fortyEightHoursAgo]);

    if (messages.length === 0) {
      console.log('✅ Aucun message interne non lu nécessitant un rappel.');
      return;
    }

    console.log(`📧 ${messages.length} message(s) trouvé(s). Envoi des rappels...`);

    // Utiliser une Map pour regrouper les rappels par utilisateur
    const remindersToSend = new Map();

    messages.forEach(msg => {
      if (!remindersToSend.has(msg.receiver_id)) {
        remindersToSend.set(msg.receiver_id, {
          email: msg.receiver_email,
          name: msg.receiver_name,
          count: 0
        });
      }
      remindersToSend.get(msg.receiver_id).count++;
    });

    // Envoyer un seul email par utilisateur
    for (const [userId, reminderData] of remindersToSend.entries()) {
      try {
        const emailHtml = internalMessageReminderTemplate({
          userName: reminderData.name,
          messageCount: reminderData.count
        });
        await sendEmail(
          reminderData.email,
          `🔔 Vous avez ${reminderData.count} message(s) non lu(s) sur ODIA`,
          emailHtml
        );
        console.log(`✅ Email de rappel envoyé à ${reminderData.email} pour ${reminderData.count} message(s).`);
      } catch (emailError) {
        console.error(`❌ Erreur lors de l'envoi de l'email à ${reminderData.email}:`, emailError);
        // Continuer avec les autres utilisateurs même en cas d'erreur sur un email
      }
    }

    console.log('🎉 Tous les rappels ont été traités.');

  } catch (error) {
    console.error('❌ Erreur lors de la récupération ou du traitement des messages internes non lus:', error);
    // Propager l'erreur pour que le scheduler puisse la logger
    throw error;
  }
}

module.exports = { sendUnreadMessageReminders };