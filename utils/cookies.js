// Fichier: backend-render/utils/cookies.js

const isProd = process.env.NODE_ENV === 'production';

// Configuration de base pour les cookies
const base = {
  httpOnly: true, // Empêche l'accès via JS côté client
  secure: isProd, // True uniquement en production (HTTPS)
  sameSite: 'lax', // Contrôle l'envoi cross-site (Lax est un bon défaut)
  domain: isProd ? '.odia-strategie.com' : undefined, // Spécifie le domaine en prod pour le sous-domaine api.*
  path: '/' // Le cookie est valide pour tout le site
};

// Helper pour définir un cookie
const set = (res, name, value, extra = {}) => {
  // Combine les options de base avec les options supplémentaires (ex: maxAge)
  res.cookie(name, value, { ...base, ...extra });
};

// Helper pour supprimer un cookie
const clear = (res, name) => {
  // Doit spécifier path et domain pour que clearCookie fonctionne correctement
  res.clearCookie(name, { path: base.path, domain: base.domain });
};

module.exports = {
  default: base, // Exporter les options par défaut pour CSRF
  set,
  clear
};