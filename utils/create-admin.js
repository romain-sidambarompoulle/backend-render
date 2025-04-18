const bcrypt = require('bcryptjs');
const db = require('../db');

async function createAdmin() {
  try {
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('Cesiteestsuper!', 10);
    
    // Vérifier si l'utilisateur existe déjà
    const checkUser = await db.query(
      'SELECT * FROM users WHERE email = $1', 
      ['contact@odia-strategie.com']
    );
    
    if (checkUser.rows.length > 0) {
      // Mettre à jour l'utilisateur existant
      await db.query(
        'UPDATE users SET password = $1, role = $2 WHERE email = $3',
        [hashedPassword, 'admin', 'contact@odia-strategie.com']
      );
      console.log('✅ Compte admin mis à jour avec succès');
    } else {
      // Créer un nouvel utilisateur admin
      const newUser = await db.query(
        'INSERT INTO users (email, password, nom, prenom, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['contact@odia-strategie.com', hashedPassword, 'Admin', 'Système', 'admin']
      );
      
      // Créer un profil pour cet utilisateur
      await db.query(
        'INSERT INTO profiles (user_id) VALUES ($1)',
        [newUser.rows[0].id]
      );
      
      console.log('✅ Compte admin créé avec succès');
    }
    
    // Vérifier que tout s'est bien passé
    const verify = await db.query(
      'SELECT * FROM users WHERE email = $1',
      ['contact@odia-strategie.com']
    );
    
    console.log('🔍 Vérification:', {
      email: verify.rows[0].email,
      role: verify.rows[0].role,
      password_length: verify.rows[0].password.length
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    // Fermer la connexion à la base de données
    process.exit(0);
  }
}

createAdmin();
