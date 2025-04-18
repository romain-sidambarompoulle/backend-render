const db = require('../db');

class RevokedToken {
  // Vérifier si un token est révoqué
  static async isTokenRevoked(token) {
    try {
      const result = await db.query(
        'SELECT * FROM revoked_tokens WHERE token = $1',
        [token]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Erreur vérification token révoqué:', error);
      throw error;
    }
  }

  // Révoquer un token
  static async revokeToken(token, userId, tokenType = 'refresh', expiresAt) {
    try {
      await db.query(
        'INSERT INTO revoked_tokens (token, user_id, token_type, revoked_at, expires_at) VALUES ($1, $2, $3, NOW(), $4)',
        [token, userId, tokenType, expiresAt]
      );
      return true;
    } catch (error) {
      console.error('Erreur révocation token:', error);
      throw error;
    }
  }

  // Nettoyer les tokens expirés
  static async cleanupExpiredTokens() {
    try {
      await db.query(
        'DELETE FROM revoked_tokens WHERE expires_at < NOW()'
      );
      return true;
    } catch (error) {
      console.error('Erreur nettoyage tokens expirés:', error);
      throw error;
    }
  }
}

module.exports = { RevokedToken };