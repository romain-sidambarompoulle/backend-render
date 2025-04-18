const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { verifyRefreshToken, REFRESH_SECRET } = require('../middleware/verifyRefreshToken');
const { RevokedToken } = require('../models/RevokedToken');
const db = require('../db');
const { sendEmail } = require('../utils/mailer');
const { resetPasswordTemplate } = require('../utils/emailTemplates');

// Clé secrète pour JWT (à mettre dans .env plus tard)
const JWT_SECRET = process.env.JWT_SECRET;

// Durées de vie des tokens
const ACCESS_TOKEN_EXPIRES = '30m'; // 30 minutes pour le token d'accès
const REFRESH_TOKEN_EXPIRES = '7d'; // 7 jours pour le refresh token

// Route d'inscription
router.post('/register', async (req, res) => {
  try {
    console.log('Données reçues dans /register:', req.body); // Debug log
    
    const { email, password, nom, prenom, role = 'visitor' } = req.body;
    
    // Vérification si l'utilisateur existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'Email déjà utilisé' 
      });
    }

    // Création de l'utilisateur dans la base de données
    const newUser = await User.create(email, password, nom, prenom, role);
    console.log('Utilisateur créé:', newUser); // Debug log

    // Génération du token JWT
    const token = jwt.sign(
      { userId: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
    
    // Génération du refresh token
    const refreshToken = jwt.sign(
      { userId: newUser.email, role: newUser.role, type: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES }
    );

    // Calcul des dates d'expiration pour le nettoyage
    const accessExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    // Stocker les tokens dans des cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes en millisecondes
      path: '/',
      sameSite: 'lax'
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
      path: '/',
      sameSite: 'lax'
    });

    // Envoi de la réponse
    res.status(201).json({
      success: true,
      user: {
        email: newUser.email,
        nom: newUser.nom,
        prenom: newUser.prenom,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: error.message // Pour le debug
    });
  }
});

// Route de connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Créer le token d'accès principal (courte durée)
    const token = jwt.sign(
      { userId: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
    
    // Créer le refresh token (longue durée)
    const refreshToken = jwt.sign(
      { userId: user.email, role: user.role, type: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES }
    );

    // Calcul des dates d'expiration pour le nettoyage
    const accessExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    // Stocker le token d'accès dans un cookie (courte durée)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes en millisecondes
      path: '/',
      sameSite: 'lax'
    });
    
    // Stocker le refresh token dans un cookie (longue durée)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
      path: '/',
      sameSite: 'lax'
    });

    // On renvoie uniquement les données utilisateur (pas le token)
    res.json({
      success: true,
      user: {
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// Nouvelle route pour rafraîchir le token d'accès
router.post('/refresh', verifyRefreshToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const currentRefreshToken = req.cookies.refreshToken;
    
    // Vérifier que l'utilisateur existe toujours
    const user = await User.findByEmail(userId);
    if (!user) {
      // Révoquer le token si l'utilisateur n'existe plus
      await RevokedToken.revokeToken(
        currentRefreshToken, 
        userId, 
        'refresh',
        new Date(req.user.exp * 1000)
      );
      
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Générer un nouveau token d'accès
    const newToken = jwt.sign(
      { userId, role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
    
    // Stocker le nouveau token dans un cookie
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes en millisecondes
      path: '/',
      sameSite: 'lax'
    });
    
    // Réponse succès
    res.json({
      success: true,
      message: 'Token rafraîchi avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token'
    });
  }
});

// Route pour vérifier l'authentification
router.get('/user-data', verifyToken, async (req, res) => {
  try {
    const user = await User.getFullProfile(req.user.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        profile: {
          telephone: user.telephone,
          adresse: user.adresse,
          date_naissance: user.date_naissance,
          situation_familiale: user.situation_familiale,
          progression: {
            profile: user.progression_profile,
            documents: user.progression_documents,
            formulaire: user.progression_formulaire,
            rdv_phone: user.progression_rdv_phone,
            rdv_strategy: user.progression_rdv_strategy
          }
        }
      }
    });
  } catch (error) {
    console.error('Erreur auth:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Non authentifié' 
    });
  }
});

// Fonction pour créer un compte visiteur
const createVisitorAccount = async (formData) => {
  try {
    const { email, nom, prenom, telephone, autoLogin } = formData;
    
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return { error: 'Cet email est déjà utilisé' };
    }

    const newUser = await User.createVisitor(email, nom, prenom || nom, telephone);
    
    let autoLoginToken = null;
    if (autoLogin) {
      autoLoginToken = jwt.sign(
        { userId: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES }
      );
    }

    return {
      success: true,
      credentials: {
        email,
        password: `${nom}123`,
        nom: newUser.nom
      },
      autoLoginToken
    };
  } catch (error) {
    console.error('Erreur création compte visiteur:', error);
    return { error: 'Erreur lors de la création du compte' };
  }
};

// Route pour changer le mot de passe
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userEmail = req.user.userId;
    
    // Vérifier l'ancien mot de passe
    const user = await User.findByEmail(userEmail);
    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Ancien mot de passe incorrect' 
      });
    }
    
    // Mettre à jour le mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, userEmail]
    );
    
    // Révoquer tous les tokens actuels pour forcer une reconnexion
    // Révoquer le token d'accès actuel
    if (req.cookies.token) {
      const decoded = jwt.decode(req.cookies.token);
      await RevokedToken.revokeToken(
        req.cookies.token,
        userEmail,
        'access',
        new Date(decoded.exp * 1000)
      );
    }
    
    // Révoquer le refresh token actuel
    if (req.cookies.refreshToken) {
      const decoded = jwt.decode(req.cookies.refreshToken);
      await RevokedToken.revokeToken(
        req.cookies.refreshToken,
        userEmail,
        'refresh',
        new Date(decoded.exp * 1000)
      );
    }
    
    // Effacer les cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    
    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès. Veuillez vous reconnecter.'
    });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe'
    });
  }
});

// Route de déconnexion
router.post('/logout', async (req, res) => {
  try {
    // Récupérer les tokens actuels
    const accessToken = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;
    
    // Si des tokens existent, les révoquer
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.exp) {
          await RevokedToken.revokeToken(
            accessToken,
            decoded.userId,
            'access',
            new Date(decoded.exp * 1000)
          );
        }
      } catch (error) {
        console.error('Erreur révocation access token:', error);
      }
    }
    
    if (refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken);
        if (decoded && decoded.exp) {
          await RevokedToken.revokeToken(
            refreshToken,
            decoded.userId,
            'refresh',
            new Date(decoded.exp * 1000)
          );
        }
      } catch (error) {
        console.error('Erreur révocation refresh token:', error);
      }
    }
    
    // Supprimer les cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
});

// ✨ NOUVELLE ROUTE: Mot de passe oublié
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔑 Demande de réinitialisation de mot de passe reçue pour : ${email}`);

    // 1. Vérifier si l'utilisateur existe
    const user = await User.findByEmail(email);
    if (!user) {
      // Répondre succès même si l'utilisateur n'existe pas pour éviter l'énumération d'emails
      console.log(`🚫 Utilisateur non trouvé pour l'email : ${email}, mais réponse succès envoyée.`);
      return res.json({
        success: true,
        message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.'
      });
    }

    // 2. Générer un token de réinitialisation sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 3. Définir la date d'expiration (1 heure à partir de maintenant)
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 heure en millisecondes

    // 4. Stocker le token et la date d'expiration dans la DB
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetToken, resetTokenExpires, email]
    );
    console.log(`💾 Token de réinitialisation stocké pour ${email}`);

    // 5. Construire l'URL de réinitialisation en utilisant la variable d'environnement
    // Assurez-vous que FRONTEND_BASE_URL est défini dans votre fichier .env (ou variables d'environnement serveur)
    // Exemple: FRONTEND_BASE_URL=http://localhost:5173 pour dev, FRONTEND_BASE_URL=https://votre-domaine.com pour prod
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'; // Fallback au cas où la variable n'est pas définie
    const resetUrl = `${frontendBaseUrl}/#/reset-password/${resetToken}`; // ✨ Modification ici pour utiliser la variable d'environnement
    console.log(`🔧 URL de réinitialisation générée : ${resetUrl}`); // Log pour vérifier

    // 6. Envoyer l'email de réinitialisation
    const emailData = {
      userName: user.prenom || user.nom, // Utiliser le prénom ou le nom s'il existe
      resetLink: resetUrl
    };

    await sendEmail(
      user.email,
      'Réinitialisation de votre mot de passe ODIA',
      resetPasswordTemplate(emailData)
    );
    console.log(`📧 Email de réinitialisation envoyé à ${email}`);

    // 7. Envoyer la réponse de succès
    res.json({
      success: true,
      message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la demande de réinitialisation de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement de votre demande.'
    });
  }
});

// ✨ NOUVELLE ROUTE: Réinitialiser le mot de passe avec le token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    console.log(`🔄 Tentative de réinitialisation avec le token : ${token}`);

    // 1. Vérifier si le nouveau mot de passe est fourni
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe est requis.'
      });
    }

    // 2. Trouver l'utilisateur par le token ET vérifier l'expiration
    const result = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    const user = result.rows[0];

    // 3. Si token invalide ou expiré
    if (!user) {
      console.log(`🚫 Token invalide ou expiré : ${token}`);
      // Renvoie un statut 400 et un message clair
      return res.status(400).json({
        success: false,
        message: 'Le lien de réinitialisation est invalide ou a expiré.'
      });
    }

    // 4. Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Mettre à jour le mot de passe et invalider le token en une seule requête
    await db.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    console.log(`✅ Mot de passe réinitialisé avec succès pour ${user.email}`);

    // 6. Envoyer la réponse de succès
    res.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation du mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe.'
    });
  }
});

module.exports = router;
module.exports.createVisitorAccount = createVisitorAccount;
