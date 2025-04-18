const jwt = require('jsonwebtoken');
const { RevokedToken } = require('../models/RevokedToken');


const JWT_SECRET = process.env.JWT_SECRET;

// Middleware pour vérifier le token d'authentification
const verifyToken = async (req, res, next) => {
  // Récupérer le token du cookie ou de l'en-tête Authorization
  let token = req.cookies.token;
  
  // Si pas de token dans les cookies, essayer dans l'en-tête Authorization
  if (!token) {
    const authHeader = req.headers['authorization'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]; // Récupérer le token après "Bearer "
      console.log('Token trouvé dans Authorization header');
    }
  } else {
    console.log('Token trouvé dans cookie');
  }
  
  // Si aucun token n'est trouvé, renvoyer une erreur 401
  if (!token) {
    console.log('❌ Aucun token trouvé (ni cookie, ni header)');
    return res.status(401).json({
      success: false,
      message: 'Non authentifié : token manquant',
      code: 'TOKEN_MISSING'
    });
  }
  
  try {
    // Vérifier si le token est révoqué (si vous avez cette fonctionnalité)
    if (typeof RevokedToken !== 'undefined' && RevokedToken.isTokenRevoked) {
      const isRevoked = await RevokedToken.isTokenRevoked(token);
      if (isRevoked) {
        return res.status(401).json({
          success: false,
          message: 'Merci de rafraîchir la page.',
          code: 'TOKEN_REVOKED'
        });
      }
    }
    
    // Vérifier le token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Erreur de vérification du token:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token invalide',
      code: 'TOKEN_INVALID'
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé. Seuls les administrateurs peuvent accéder à cette ressource.',
      code: 'FORBIDDEN'
    });
  }
  next();
};

module.exports = { verifyToken, isAdmin };