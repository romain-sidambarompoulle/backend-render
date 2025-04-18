const { RevokedToken } = require('../models/RevokedToken');

// Fonction à exécuter périodiquement pour nettoyer les tokens expirés
const cleanupExpiredTokens = async () => {
  try {
    console.log('🧹 Nettoyage des tokens révoqués expirés...');
    await RevokedToken.cleanupExpiredTokens();
    console.log('✅ Nettoyage terminé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des tokens:', error);
  }
};

module.exports = { cleanupExpiredTokens };