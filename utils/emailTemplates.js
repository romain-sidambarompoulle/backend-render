// /backend-render/utils/emailTemplates.js
// Ce fichier regroupe toutes les templates d'emails utilisées dans le projet.

const SITE_URL = process.env.FRONTEND_URL || 'https://odia-strategie.com';

/**
 * Template pour l'email envoyé après qu'un utilisateur remplit le formulaire "home"
 * @param {object} data - objet contenant les infos nécessaires (par ex: nom, email, contenu du formulaire)
 * @returns {string} HTML du mail
 */
function homeFormTemplate(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      <p>Bienvenue chez ODIA ! Toute notre équipe est impatiente de vous présenter les résultats
      concrets que vous pourrez atteindre avec ODIA.</p>
      <p>Votre compte visiteur a été créé avec succès, voici vos informations de connexion :</p>
      <ul>
        <li>Identifiant : ${data.email}</li>
        <li>Mot de passe provisoire : ${data.password}</li>
      </ul>
      <p>Pour garantir la sécurité de votre compte, nous vous recommandons vivement de
      modifier dès maintenant votre mot de passe depuis votre espace personnel ODIA.</p>

      <h3>Qui sommes-nous ?</h3>
      <p>ODIA optimise votre gestion interne en prenant en charge l'ensemble de vos démarches
      administratives avec efficacité et rigueur. Notre approche personnalisée garantit des
      solutions adaptées spécifiquement à votre profession libérale.</p>

      <h3>Quelle est la prochaine étape ?</h3>
      <p>✏️ Remplissez votre formulaire personnalisé<br />
      Complétez le formulaire avec vos informations. Nous utiliserons ces données pour
      préparer votre simulation personnalisée.</p>

      <p>✅ Prenez rendez-vous pour votre entretien stratégique<br />
      Choisissez une date qui vous convient. Nous vous présenterons alors votre simulation
      personnalisée.</p>

      <p>❓ Une question ou besoin de précisions ?<br />
      À tout moment, prenez un rendez-vous téléphonique via votre espace personnel ODIA.
      Notre équipe est disponible pour répondre à vos interrogations et vous accompagner.</p>

      <p>📖 Un guide pratique gratuit, spécialement conçu pour vous fournir des informations
      structurées sur votre profession libérale est dès à présent disponible sur votre espace
      ODIA.</p>

      <p>📁 Vos informations évoluent ?<br />
      Depuis votre espace personnel, vous pouvez modifier facilement vos données ou gérer
      vos rendez-vous à tout instant.</p>

      <p>Si vous rencontrez la moindre difficulté, contactez-nous sur : contact@odia-strategie.com
      ou demandez à être rappelé directement par mail.</p>

      <p>À bientôt,<br />
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email envoyé après qu'un utilisateur réserve un RDV téléphonique
   * @param {object} data - infos sur le RDV (nom, date, heure)
   * @returns {string} HTML du mail
   */
  function phoneAppointmentTemplate(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      <p>Votre rendez-vous téléphonique avec ODIA est confirmé.</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : connectez‑vous à votre espace personnel sur <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a> afin de connaître l’heure exacte de votre rendez‑vous, automatiquement ajustée à votre fuseau horaire.</li>
      </ul>
      <p>Notre équipe est prête à échanger avec vous et répondre à vos questions.</p>
      
      <p><strong>Un empêchement ou une modification à apporter ?</strong><br>
      Vous pouvez directement annuler ou modifier votre rendez-vous depuis votre espace
      personnel ODIA. Si besoin, choisissez un nouveau créneau qui vous convient.</p>
      
      <p>Pour toute autre difficulté ou question complémentaire, contactez-nous par mail à :
      contact@odia-strategie.com.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email envoyé après qu'un utilisateur réserve un RDV stratégique
   * @param {object} data - infos sur le RDV (nom, date, heure)
   * @returns {string} HTML du mail
   */
  function strategyAppointmentTemplate(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      <p>Excellente nouvelle ! Votre rendez-vous stratégique personnalisé avec ODIA est bien
      confirmé.</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : connectez‑vous à votre espace personnel sur <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a> afin de connaître l’heure exacte de votre rendez‑vous, automatiquement ajustée à votre fuseau horaire.</li>
      </ul>
      <p>Lors de ce rendez-vous, vous pourrez clairement visualiser les différents choix qui s'offrent
      à vous, mesurer les économies réalisables, et imaginer ainsi la vie que vous pourriez avoir
      en vous libérant totalement des contraintes administratives.</p>
      
      <p><strong>Un empêchement ou une modification à apporter ?</strong><br>
      Vous pouvez directement annuler ou modifier votre rendez-vous depuis votre espace
      personnel ODIA. Si besoin, choisissez un nouveau créneau qui vous convient.</p>
      
      <p>Pour toute autre difficulté ou question complémentaire, contactez-nous par mail à :
      contact@odia-strategie.com.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email envoyé après qu'un utilisateur termine de remplir un formulaire dans son espace utilisateur
   * @param {object} data - infos sur le formulaire (nom, type, contenu)
   * @returns {string} HTML du mail
   */
  function userFormTemplate(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      
      <p>Nous vous confirmons que toutes vos informations nous sont bien parvenues.
      Notre équipe ODIA analyse déjà en détail votre situation personnelle et professionnelle.
      Grâce à ces informations précieuses, nous allons pouvoir vous proposer très
      prochainement une simulation claire et précise des meilleures stratégies possibles
      pour vous.</p>
      
      <p>En confiant votre administratif à ODIA, vous aurez enfin la liberté de faire des choix sans
      vous préoccuper de la complexité des démarches. Vous découvrirez alors concrètement
      les économies importantes que vous pourrez réaliser et pourrez accéder directement aux
      options les plus avantageuses financièrement pour vous.</p>
      
      <h3>La prochaine étape ?</h3>
      <p>Réservez dès maintenant votre entretien stratégique dans votre espace personnel ODIA,
      afin de découvrir tous les bénéfices concrets qui vous attendent.</p>
      
      <p>Nous avons hâte de vous faire découvrir le potentiel que vous pouvez atteindre en
      travaillant avec nous !</p>
      
      <p>❓ Une question ou besoin d'échanger directement ?<br>
      À tout moment, prenez rendez-vous téléphonique via votre espace personnel, ou
      contactez-nous à : contact@odia-strategie.com.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
      
      <div style="margin-top: 20px; font-size: 0.8em; color: #666;">
        <p>Détails du formulaire enregistré :</p>
        <ul>
          <li>Type: ${data.formType}</li>
          <li>Date: ${data.details}</li>
        </ul>
      </div>
    `;
  }
  
  /**
   * Template pour l'email de rappel envoyé avant un rendez-vous programmé
   * @param {object} data - infos sur le RDV (nom, type, date, heure)
   * @returns {string} HTML du mail
   */
  function appointmentReminderTemplate(data) {
    return `
      <h1>Rappel de votre rendez-vous ${data.type === 'tel' ? 'téléphonique' : 'stratégique'}</h1>
      <p>Bonjour ${data.userName},</p>
      <p>Nous vous rappelons votre rendez-vous prévu :</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : connectez‑vous à votre espace personnel sur <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a> afin de connaître l’heure exacte de votre rendez‑vous, automatiquement ajustée à votre fuseau horaire.</li>
      </ul>
      <p>Nous avons hâte de vous rencontrer !</p>
    `;
  }
  
  /**
   * Template pour l'email de rappel envoyé 24h avant un rendez-vous programmé
   * @param {object} data - infos sur le RDV (nom, type, date, heure)
   * @returns {string} HTML du mail
   */
  function appointmentReminderTemplate24h(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      
      <p>Rappel de votre rendez-vous ODIA :</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : connectez‑vous à votre espace personnel sur <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a> afin de connaître l’heure exacte de votre rendez‑vous, automatiquement ajustée à votre fuseau horaire.</li>
      </ul>
      
      <p>Toute l'équipe a soigneusement étudié les informations que vous nous avez transmises
      afin de préparer ce rendez-vous stratégique. Vous découvrirez ainsi clairement la stratégie
      ODIA spécifiquement conçue pour vous, et pourrez en mesurer concrètement tout le
      potentiel.</p>
      
      <p><strong>Un empêchement ou une modification à apporter ?</strong><br>
      Vous pouvez directement annuler ou modifier votre rendez-vous depuis votre espace
      personnel ODIA. Si besoin, choisissez un nouveau créneau qui vous convient.</p>
      
      <p>Pour toute autre difficulté ou question complémentaire, contactez-nous par mail à :
      contact@odia-strategie.com.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email de rappel envoyé 2h avant un rendez-vous programmé
   * @param {object} data - infos sur le RDV (nom, type, date, heure)
   * @returns {string} HTML du mail
   */
  function appointmentReminderTemplate2h(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      
      <p>Votre rendez-vous ODIA débute dans exactement 2 heures :</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : connectez‑vous à votre espace personnel sur <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">${SITE_URL}</a> afin de connaître l’heure exacte de votre rendez‑vous, automatiquement ajustée à votre fuseau horaire.</li>
      </ul>
      
      <p>Nous avons hâte de vous retrouver et d'avancer ensemble.</p>
      
      <p><strong>Un empêchement ou une modification à apporter ?</strong><br>
      Vous pouvez directement annuler ou modifier votre rendez-vous depuis votre espace
      personnel ODIA. Si besoin, choisissez un nouveau créneau qui vous convient.</p>
      
      <p>Pour toute autre difficulté ou question complémentaire, contactez-nous par mail à :
      contact@odia-strategie.com.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email envoyé après qu'un utilisateur met à jour un formulaire dans son espace utilisateur
   * @param {object} data - infos sur le formulaire mis à jour (nom, type, contenu)
   * @returns {string} HTML du mail
   */
  function userFormUpdateTemplate(data) {
    return `
      <p>Bonjour ${data.userName},</p>
      
      <p>Nous vous confirmons que les modifications apportées à votre formulaire personnalisé ont
      bien été enregistrées.</p>
      <p>Votre stratégie ODIA est désormais ajustée et optimisée selon ces nouvelles informations.</p>
      
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * Template pour l'email envoyé à l'admin lorsqu'un client annule un rendez-vous
   * @param {object} data - infos sur le RDV annulé (nom client, type, date, heure)
   * @returns {string} HTML du mail
   */
  function adminAppointmentCanceledTemplate(data) {
    return `
      <h1>Annulation d'un rendez-vous</h1>
      <p>Le client ${data.userName} a annulé son rendez-vous de type ${data.type}.</p>
      <ul>
        <li>Date : ${data.date}</li>
        <li>Heure : ${data.time}</li>
      </ul>
    `;
  }
  
  /**
   * ✨ NOUVEAU: Template pour l'email de réinitialisation de mot de passe ✨
   * @param {object} data - Doit contenir { userName, resetLink }
   * @returns {string} HTML du mail
   */
  function resetPasswordTemplate(data) {
    return `
      <h1>Réinitialisation de votre mot de passe ODIA</h1>
      <p>Bonjour ${data.userName || 'Utilisateur'},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ODIA.</p>
      <p>Si vous êtes à l'origine de cette demande, veuillez cliquer sur le lien ci-dessous pour définir un nouveau mot de passe. Ce lien expirera dans 1 heure.</p>
      <p><a href="${data.resetLink}" target="_blank">Réinitialiser mon mot de passe</a></p>
      <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  /**
   * ✨ NOUVEAU: Template pour l'email de rappel de message interne non lu ✨
   * @param {object} data - Doit contenir { userName, messageCount }
   * @returns {string} HTML du mail
   */
  function internalMessageReminderTemplate(data) {
    const plural = data.messageCount > 1 ? 's' : '';
    return `
      <h1>🔔 Rappel : Message${plural} important${plural} de l'équipe ODIA</h1>
      <p>Bonjour ${data.userName},</p>
      <p>Nous remarquons que vous n'avez pas encore consulté ${data.messageCount > 1 ? `les ${data.messageCount} messages` : `un message`} que nous vous avons envoyé${plural} il y a plus de 48 heures sur votre espace personnel ODIA.</p>
      <p>Ces messages peuvent contenir des informations importantes concernant votre accompagnement ou des étapes clés de votre parcours avec nous.</p>
      <p>Connectez-vous dès maintenant à votre espace pour consulter vos messages et rester informé :</p>
      <p><a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">Accéder à mon espace ODIA</a></p>
      <p>Si vous rencontrez des difficultés pour vous connecter ou si vous avez des questions, n'hésitez pas à nous contacter.</p>
      <p>À bientôt,<br>
      L'équipe ODIA</p>
    `;
  }
  
  module.exports = {
    homeFormTemplate,
    phoneAppointmentTemplate,
    strategyAppointmentTemplate,
    userFormTemplate,
    userFormUpdateTemplate,
    appointmentReminderTemplate,
    appointmentReminderTemplate24h,
    appointmentReminderTemplate2h,
    adminAppointmentCanceledTemplate,
    resetPasswordTemplate,
    internalMessageReminderTemplate
  };