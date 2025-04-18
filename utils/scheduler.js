const cron = require('node-cron');
const { sendAppointmentReminders } = require('./reminderService');
const { cleanupExpiredTokens } = require('./tokenCleanup');
const { sendUnreadMessageReminders } = require('./internalMessagesReminder');

// Rappel 24h à 2h du matin
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Running job: Send 24h appointment reminders...');
  try {
    await sendAppointmentReminders(24);
    console.log('✅ Job finished: Send 24h appointment reminders.');
  } catch (error) {
    console.error('❌ Error running job: Send 24h appointment reminders:', error);
  }
}, {
  scheduled: true,
  timezone: "Indian/Reunion"
});

// Rappel 2h toutes les heures
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running job: Send 2h appointment reminders...');
  try {
    await sendAppointmentReminders(2);
    console.log('✅ Job finished: Send 2h appointment reminders.');
  } catch (error) {
    console.error('❌ Error running job: Send 2h appointment reminders:', error);
  }
}, {
  scheduled: true,
  timezone: "Indian/Reunion"
});

// Nettoyer les tokens révoqués expirés tous les jours à 3h du matin
cron.schedule('0 3 * * *', async () => {
  console.log('⏰ Running job: Cleanup expired tokens...');
  try {
    await cleanupExpiredTokens();
    console.log('✅ Job finished: Cleanup expired tokens.');
  } catch (error) {
    console.error('❌ Error running job: Cleanup expired tokens:', error);
  }
}, {
  scheduled: true,
  timezone: "Indian/Reunion"
});

// ✨ NOUVEAU: Rappel pour les messages internes non lus tous les jours à 10h
cron.schedule('0 10 * * *', async () => {
  console.log('⏰ Running job: Send unread internal message reminders...');
  try {
    await sendUnreadMessageReminders();
    console.log('✅ Job finished: Send unread internal message reminders.');
  } catch (error) {
    // Logger l'erreur mais ne pas arrêter le scheduler
    console.error('❌ Error running job: Send unread internal message reminders:', error);
  }
}, {
  scheduled: true,
  timezone: "Indian/Reunion" // Utiliser le même fuseau horaire
});

// Aucun export nécessaire si on ne l'appelle pas directement.
// On se contente d'importer ce fichier dans server.js.
