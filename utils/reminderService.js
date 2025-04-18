const db = require('../db');
const { sendEmail } = require('./mailer');
const { 
  appointmentReminderTemplate, 
  appointmentReminderTemplate24h, 
  appointmentReminderTemplate2h 
} = require('./emailTemplates');

/**
 * Envoie les emails de rappel pour les rendez-vous qui auront lieu dans X heures
 * @param {number} hoursBeforeAppointment - Nombre d'heures avant le rendez-vous pour envoyer le rappel
 */
async function sendAppointmentReminders(hoursBeforeAppointment = 24) {
  try {
    // Calculer la plage de temps pour les rappels
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime());
    const reminderWindowEnd = new Date(now.getTime() + (hoursBeforeAppointment * 60 * 60 * 1000));
    
    // Définir la condition de vérification de rappel en fonction du délai
    const reminderCondition = 
      hoursBeforeAppointment === 24 ? 'AND r.reminder_sent_24h IS NOT TRUE' : 
      hoursBeforeAppointment === 2 ? 'AND r.reminder_sent_2h IS NOT TRUE' : 
      'AND FALSE'; // Désactiver pour les autres délais sauf si explicitement gérés plus tard

    // Requête pour trouver les rendez-vous qui auront lieu dans la plage définie
    const result = await db.query(`
      SELECT r.id, r.user_id, r.type, r.status,
             ts.start_datetime, ts.end_datetime,
             u.email, u.nom, u.prenom
      FROM rdv r
      JOIN time_slots ts ON r.time_slot_id = ts.id
      JOIN users u ON r.user_id = u.id
      WHERE ts.start_datetime BETWEEN $1 AND $2
      AND r.status = 'scheduled'
      ${reminderCondition}
    `, [reminderWindowStart.toISOString(), reminderWindowEnd.toISOString()]);
    
    // Envoyer les rappels pour chaque rendez-vous trouvé
    for (const appointment of result.rows) {
      try {
        const startDate = new Date(appointment.start_datetime);
        const formattedDate = startDate.toLocaleDateString('fr-FR', { 
          day: '2-digit', month: '2-digit', year: 'numeric' 
        });
        const formattedTime = startDate.toLocaleTimeString('fr-FR', { 
          hour: '2-digit', minute: '2-digit' 
        });
        
        // Données pour le template de l'email
        const emailData = {
          userName: `${appointment.prenom} ${appointment.nom}`,
          type: appointment.type,
          date: formattedDate,
          time: formattedTime
        };
        
        // Sélectionner le bon template en fonction du délai avant le rendez-vous
        let reminderTemplate;
        let subjectPrefix;
        
        if (hoursBeforeAppointment === 24) {
          reminderTemplate = appointmentReminderTemplate24h(emailData);
          subjectPrefix = "Rappel (J-1)";
        } else if (hoursBeforeAppointment === 2) {
          reminderTemplate = appointmentReminderTemplate2h(emailData);
          subjectPrefix = "Rappel urgent";
        } else {
          // Fallback sur le template standard pour les autres délais
          reminderTemplate = appointmentReminderTemplate(emailData);
          subjectPrefix = "Rappel";
        }
        
        // Envoyer l'email au client
        await sendEmail(
          appointment.email,
          `${subjectPrefix} : votre rendez-vous ${appointment.type === 'tel' ? 'téléphonique' : 'stratégique'}`,
          reminderTemplate
        );
        
        // Envoyer l'email à l'admin
        const adminHTML = `
          <h2>Rappel de rendez-vous à venir</h2>
          <p>Un rendez-vous est prévu ${hoursBeforeAppointment === 24 ? 'demain' : 'dans 2 heures'} :</p>
          <ul>
            <li>Client : ${appointment.prenom} ${appointment.nom} (${appointment.email})</li>
            <li>Type : ${appointment.type === 'tel' ? 'Téléphonique' : 'Stratégique'}</li>
            <li>Date : ${formattedDate}</li>
            <li>Heure : ${formattedTime}</li>
          </ul>
        `;
        
        await sendEmail(
          process.env.GMAIL_USER,
          `${subjectPrefix} : RDV ${appointment.type === 'tel' ? 'téléphonique' : 'stratégique'} avec ${appointment.prenom} ${appointment.nom}`,
          adminHTML
        );
        
        // Marquer le rappel comme envoyé selon le délai
        if (hoursBeforeAppointment === 24) {
          await db.query(
            'UPDATE rdv SET reminder_sent_24h = TRUE WHERE id = $1',
            [appointment.id]
          );
        } else if (hoursBeforeAppointment === 2) {
          await db.query(
            'UPDATE rdv SET reminder_sent_2h = TRUE WHERE id = $1',
            [appointment.id]
          );
        }
      } catch (error) {
        // Silencieux en cas d'erreur
      }
    }
  } catch (error) {
    // Silencieux en cas d'erreur
  }
}

module.exports = { sendAppointmentReminders };
