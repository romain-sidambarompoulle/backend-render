const express = require("express");
const cors = require("cors");
const axios = require("axios");
// ✨ MODIFICATION: Charger dotenv seulement en développement
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
// Importer le planificateur de tâches
require('./utils/scheduler');
const authRoutes = require('./routes/auth');
const { User, users } = require('./models/User'); // Ajout de l'import du modèle User
const adminRoutes = require('./routes/admin');  // Routes admin générales (peut-être à garder pour /stats, /users etc non liés aux messages)
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/user');
const db = require('./db');
const timeSlotsRoutes = require('./routes/timeSlots');
const appointmentsRoutes = require('./routes/appointments');
const { createVisitorAccount } = require('./routes/auth');
const educationRoutes = require('./routes/education');
// Ajouter l'import pour csurf
const csrf = require('csurf');

// ✨ Importer mailer et templates
const { sendEmail } = require('./utils/mailer');
const {
  homeFormTemplate,
  phoneAppointmentTemplate,
  strategyAppointmentTemplate,
  userFormTemplate
} = require('./utils/emailTemplates');

// ✨ Importer les routes pour le chat
const chatRoutes = require('./routes/chatRoutes');

// ✨ Importer les nouvelles routes pour les messages internes utilisateur
const internalMessagesUserRoutes = require('./routes/user/internalMessages');

// ✨ Importer le nouveau routeur pour les messages internes admin
const internalMessagesAdminRoutes = require('./routes/admin/internalMessagesAdmin'); 

// ✨ Importer le nouveau routeur pour les messages chat admin
const chatMessagesAdminRoutes = require('./routes/admin/chatMessagesAdmin');

// ✨ Logger visible uniquement hors production
const devLogger = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

const app = express();

// Désactiver les ETags pour tout le serveur
app.disable('etag');
app.set('x-powered-by', false);

// 1. D'abord les middlewares de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 2. Ensuite CORS
// ✨ MODIFICATION: Remplacer la liste statique par une lecture dynamique depuis .env
// Liste autorisée issue de l'ENV ALLOWED_ORIGINS=url1,url2
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Ajout localhost uniquement en dev
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
  );
}

app.use(cors({
  origin: allowedOrigins, // Utilisation de la liste dynamique
  credentials: true,                // Important pour les cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'CSRF-Token',
    'Cache-Control',
    'Pragma',
    'Expires'
  ] // Ajout des en-têtes de cache
}));

// 3. Ajouter le middleware CSRF après CORS
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
  },
  // ✨ Ignorer automatiquement les méthodes non modificatrices
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'], 
});

// ✨ Appliquer la protection CSRF globalement ici, AVANT le logging et les routes spécifiques
app.use(csrfProtection); 

// 3. Middleware de logging après le parsing - UNIQUEMENT EN DEV
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    devLogger(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    devLogger('Headers:', req.headers);
    if (req.body) devLogger('Body:', req.body);
    next();
  });
}

// ✨ Importer les URLs depuis la configuration
const { GOOGLE_SHEET_URL, OPENAI_API_URL, SIMULATOR_URLS } = require('./config/externalApis');

// Route de test pour vérifier que le backend est actif
app.get("/", (req, res) => {
  res.json({ message: "🚀 Backend actif sur Render !" });
});

// Route de test
// ✨ CONDITIONNEL: Uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Connexion réussie avec le backend!' });
  });
}

// Route pour voir les utilisateurs (uniquement en développement)
// ✨ CONDITIONNEL: Uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/users', (req, res) => {
    // On ne renvoie pas les mots de passe
    const safeUsers = users.map(user => ({
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      profession: user.profession,
      createdAt: user.createdAt
    }));
    res.json(safeUsers);
  });
}

// 📌 **Route pour envoyer les données à Google Sheets (proxy vers Apps Script)**
app.post("/submit-form", csrfProtection, async (req, res) => {
  try {
    devLogger("📩 Données reçues sur /submit-form :", req.body); // ✨ Utilisation de devLogger

    // Vérifier si les champs essentiels sont remplis
    if (!req.body.nom || !req.body.email || !req.body.telephone) {
      return res.status(400).json({ 
        success: false, 
        message: "Le nom, l'email et le téléphone sont requis." 
      });
    }

    // Créer le compte visiteur
    const visitorAccount = await createVisitorAccount(req.body);
    
    // ✨ MODIFICATION: Vérifier si l'email existe déjà (erreur spécifique de createVisitorAccount)
    if (visitorAccount.error && visitorAccount.error === 'Cet email est déjà utilisé') {
      return res.status(409).json({ // Renvoyer 409 Conflict
        success: false, 
        message: "Email déjà utilisé" // Message standardisé
      });
    } else if (visitorAccount.error) { // Gérer les autres erreurs potentielles
      return res.status(400).json({ 
        success: false, 
        message: visitorAccount.error 
      });
    }

    // Si un autoLoginToken est présent, le stocker dans un cookie
    if (visitorAccount.autoLoginToken) {
      res.cookie('token', visitorAccount.autoLoginToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000, // 30 minutes
        path: '/',
        sameSite: 'lax'
      });
      devLogger('✅ Cookie token défini avec succès'); // ✨ Utilisation de devLogger
    }

    // ✨ NOUVEAU: Envoyer un email à l'utilisateur
    const userHTML = homeFormTemplate({
      userName: req.body.nom,
      email: req.body.email,
      // ✨ MODIFICATION: S'assurer que le mot de passe est bien inclus si le compte est créé
      message: req.body.message || "Aucun message spécifique",
      password: visitorAccount.credentials?.password // Accès sécurisé au mot de passe potentiel
    });
    await sendEmail(req.body.email, 'Votre compte ODIA est activé ✅', userHTML);

    // ✨ NOUVEAU: Envoyer un email à l'admin
    const adminHTML = `<p>Un nouvel utilisateur a rempli le formulaire home:</p>
      <ul>
        <li>Nom: ${req.body.nom}</li>
        <li>Email: ${req.body.email}</li>
        <li>Téléphone: ${req.body.telephone}</li>
      </ul>`;
    await sendEmail(process.env.GMAIL_USER, 'Nouvelle soumission formulaire accueil', adminHTML);

    res.json({
      success: true,
      // ✨ MODIFICATION: Renvoyer les credentials seulement si le compte a été créé avec succès
      credentials: visitorAccount.credentials,
      autoLoginToken: visitorAccount.autoLoginToken
    });

  } catch (error) {
    devLogger("❌ Erreur lors du traitement du formulaire :", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors du traitement du formulaire." 
    });
  }
});

// 📌 **Route pour le Chatbot OpenAI**
app.post("/chatbot", csrfProtection, async (req, res) => {
  try {
    devLogger("📩 Message reçu :", req.body); // ✨ Utilisation de devLogger

    if (!req.body.message) {
      return res.status(400).json({ success: false, message: "Le message est requis." });
    }

    // Envoyer la requête à OpenAI
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4",
        messages: [{ role: "user", content: req.body.message }],
        max_tokens: 100,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    devLogger("✅ Réponse OpenAI :", response.data); // ✨ Utilisation de devLogger
    res.json({ success: true, response: response.data.choices[0].message.content });

  } catch (error) {
    devLogger("❌ Erreur OpenAI :", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Erreur lors de la communication avec OpenAI." });
  }
});

// 4. Route pour obtenir un token CSRF - Elle doit venir APRÈS app.use(csrfProtection)
app.get('/api/csrf-token', (req, res) => { // csrfProtection est appliqué globalement
  devLogger('📝 GET /api/csrf-token - Génération d\'un nouveau token CSRF'); // ✨ Utilisation de devLogger
  
  // Forcer un status 200 explicitement
  res.status(200);
  
  // Ajouter des en-têtes pour éviter la mise en cache
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  // Générer un ETag unique pour éviter le cache
  const uniqueETag = Math.random().toString(36).substring(2);
  res.set('ETag', uniqueETag);
  devLogger('📝 ETag généré:', uniqueETag); // ✨ Utilisation de devLogger
  
  // Mettre à jour la date de modification à chaque appel
  res.set('Last-Modified', new Date().toUTCString());
  
  // Générer un token CSRF
  const csrfToken = req.csrfToken();
  devLogger('📝 Token CSRF généré:', csrfToken); // ✨ Utilisation de devLogger
  
  // Envoyer la réponse
  const responseBody = { 
    csrfToken: csrfToken,
    timestamp: Date.now(),
    random: Math.random() // Garantit que le corps est toujours différent
  };
  devLogger('📝 Réponse complète:', responseBody); // ✨ Utilisation de devLogger
  
  res.json(responseBody);
});

// 5. ✨ Supprimer les applications spécifiques et conditionnelles de csrfProtection
// Note: ne pas l'appliquer aux routes qui reçoivent des requêtes d'API externes

// Route de déconnexion - log amélioré
app.use('/api/auth/logout', (req, res, next) => { // csrfProtection global s'applique ici
  devLogger('📝 LOGOUT - Headers complets:', req.headers); // ✨ Utilisation de devLogger
  devLogger('📝 LOGOUT - Token CSRF reçu:', req.headers['csrf-token']); // ✨ Utilisation de devLogger
  devLogger('📝 LOGOUT - Body complet:', req.body); // ✨ Utilisation de devLogger
  devLogger('📝 LOGOUT - Cookies:', req.cookies); // ✨ Utilisation de devLogger
  next();
});

// Middleware de logging des chemins
app.use((req, res, next) => {
  devLogger(`${req.method} ${req.path}`); // ✨ Utilisation de devLogger
  next();
});

// Puis les routes
app.use('/api/auth', authRoutes);

// Monter les routeurs admin (l'ordre spécifique vs général importe moins avec CSRF global)
app.use('/api/admin/messages', internalMessagesAdminRoutes); // Gère /api/admin/messages/...
app.use('/api/admin/chat-messages', chatMessagesAdminRoutes);

app.use('/api/admin', adminRoutes); // Le routeur admin principal

// Monter les routeurs user
app.use('/api/user/messages', internalMessagesUserRoutes); // Route user -> admin message

// Le routeur user principal 
app.use('/api/user', userRoutes);

app.use('/api/time_slots', timeSlotsRoutes);
app.use('/api/rdv', appointmentsRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/chat', chatRoutes); // Routes widget public

// Proxy pour les appels au Google Apps Script (évite les problèmes CORS)
app.get('/api/simulateur/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { brut } = req.query;

    // Vérifier que le type demandé existe
    if (!SIMULATOR_URLS[type]) {
      return res.status(400).json({
        success: false,
        error: `Type de simulateur '${type}' non reconnu`
      });
    }

    devLogger(`🔄 Proxy simulateur: appel ${type} avec brut=${brut}`); // ✨ Utilisation de devLogger

    // Faire l'appel au Google Apps Script depuis le serveur
    const response = await axios.get(`${SIMULATOR_URLS[type]}?brut=${brut}`);

    // Renvoyer les données au client
    res.json(response.data);
  } catch (error) {
    devLogger('❌ Erreur proxy simulateur:', error.message);
    res.status(500).json({ 
      success: false, 
      error: "Une erreur est survenue lors de l'appel au simulateur"
    });
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`); // Garder ce log essentiel
});