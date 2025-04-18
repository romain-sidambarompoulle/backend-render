const jwt = require('jsonwebtoken');
const { RevokedToken } = require('../models/RevokedToken');
require('dotenv').config();

// Utiliser les variables d'environnement pour les secrets
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Vérification que les variables d'environnement sont définies
if (!JWT_SECRET || !REFRESH_SECRET) {
  console.error('ERREUR: JWT_SECRET et REFRESH_SECRET doivent être définis dans le fichier .env');
  process.exit(1); // Arrêter l'application si les secrets ne sont pas définis
}

// Middleware pour vérifier le refresh token
const verifyRefreshToken = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token manquant'
    });
  }

  try {
    // Vérifier si le token est révoqué
    const isRevoked = await RevokedToken.isTokenRevoked(refreshToken);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: 'Merci de rafraîchir la page.'
      });
    }

    // Vérifier la validité du refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erreur refresh token:', error);
    return res.status(401).json({
      success: false,
      message: 'Refresh token invalide ou expiré'
    });
  }
};

module.exports = { verifyRefreshToken, REFRESH_SECRET };