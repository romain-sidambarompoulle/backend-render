const db = require('../db');
const bcrypt = require('bcryptjs');

class User {
  constructor(email, password, nom, prenom, profession, role = 'user') {
    this.email = email;
    this.password = password;  // Le mot de passe sera déjà hashé lors de l'inscription
    this.nom = nom;
    this.prenom = prenom;
    this.profession = profession;
    this.role = role;  // Par défaut 'user' si non spécifié
    this.createdAt = new Date();
    // Ajout des nouvelles propriétés
    this.profile = {
      informations: {
        telephone: '',
        adresse: '',
        dateNaissance: '',
        situationFamiliale: '',
      },
      documents: [],
      formulaires: {
        situation: {
          status: 'pending',
          data: null,
          lastUpdate: null
        }
      },
      rdv: {
        telephone: {
          status: 'pending',
          date: null
        },
        strategie: {
          status: 'pending',
          date: null
        }
      },
      simulation: {
        status: 'pending',
        data: null,
        lastUpdate: null
      },
      progression: {
        profile: 0,
        documents: 0,
        formulaire: 0,
        rdvPhone: 0,
        rdvStrategy: 0,
        simulation: 0
      }
    };
  }

  // Créer un utilisateur
  static async create(email, password, nom, prenom, role = 'user') {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userResult = await db.query(
        'INSERT INTO users (email, password, nom, prenom, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [email, hashedPassword, nom, prenom, role]
      );

      await db.query(
        'INSERT INTO profiles (user_id) VALUES ($1)',
        [userResult.rows[0].id]
      );

      return userResult.rows[0];
    } catch (error) {
      console.error('Erreur création utilisateur:', error);
      throw error;
    }
  }

  // Trouver un utilisateur par email
  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  // Obtenir le profil complet
  static async getFullProfile(userId) {
    const result = await db.query(
      `SELECT u.*, p.*, 
        (SELECT json_agg(d.*) FROM documents d WHERE d.user_id = u.id) as documents,
        (SELECT json_agg(f.*) FROM formulaires f WHERE f.user_id = u.id) as formulaires,
        (SELECT json_agg(r.*) FROM rdv r WHERE r.user_id = u.id) as rendez_vous
       FROM users u 
       LEFT JOIN profiles p ON u.id = p.user_id 
       WHERE u.email = $1`,
      [userId]
    );
    return result.rows[0];
  }

  // Mettre à jour le profil
  static async updateProfile(userId, profileData) {
    try {
      console.log('Updating profile for user:', userId, 'with data:', profileData); // Debug log

      const result = await db.query(
        `UPDATE profiles 
         SET 
           telephone = $1::text, 
           adresse = $2::text, 
           date_naissance = $3::date, 
           situation_familiale = $4::text,
           progression_profile = 
             CASE 
               WHEN $1 IS NOT NULL AND $2 IS NOT NULL AND $3 IS NOT NULL AND $4 IS NOT NULL 
               THEN 100 
               ELSE progression_profile 
             END
         WHERE user_id = (SELECT id FROM users WHERE email = $5)
         RETURNING *`,
        [
          profileData.telephone || null,
          profileData.adresse || null,
          profileData.dateNaissance || null,
          profileData.situationFamiliale || null,
          userId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Profil non trouvé');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Erreur dans updateProfile:', error);
      throw error;
    }
  }

  // Ajouter un document
  static async addDocument(userId, documentData) {
    const result = await db.query(
      `INSERT INTO documents (user_id, nom, type, url) 
       VALUES ((SELECT id FROM users WHERE email = $1), $2, $3, $4)
       RETURNING *`,
      [userId, documentData.nom, documentData.type, documentData.url]
    );
    
    await db.query(
      `UPDATE profiles 
       SET progression_documents = 
         CASE 
           WHEN (SELECT COUNT(*) FROM documents WHERE user_id = (SELECT id FROM users WHERE email = $1)) >= 5 
           THEN 100 
           ELSE (SELECT COUNT(*) FROM documents WHERE user_id = (SELECT id FROM users WHERE email = $1)) * 20 
         END
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [userId]
    );

    return result.rows[0];
  }

  // Sauvegarder un formulaire
  static async saveFormulaire(userId, formData) {
    const result = await db.query(
      `INSERT INTO formulaires (user_id, type, donnees) 
       VALUES ((SELECT id FROM users WHERE email = $1), 'situation', $2)
       RETURNING *`,
      [userId, formData]
    );

    await db.query(
      `UPDATE profiles 
       SET progression_formulaire = 100 
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [userId]
    );

    return result.rows[0];
  }

  // Planifier un RDV
  static async planifierRdv(userId, type, date) {
    const result = await db.query(
      `INSERT INTO rdv (user_id, type, date) 
       VALUES ((SELECT id FROM users WHERE email = $1), $2, $3)
       RETURNING *`,
      [userId, type, date]
    );

    const progressionField = type === 'telephone' ? 'progression_rdv_phone' : 'progression_rdv_strategy';
    await db.query(
      `UPDATE profiles 
       SET ${progressionField} = 100 
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [userId]
    );

    return result.rows[0];
  }

  // Créer un compte visiteur
  static async createVisitor(email, nom, prenom, telephone = '') {
    const visitorPassword = `${nom}123`;
    // Créer l'utilisateur
    const user = await this.create(email, visitorPassword, nom, prenom, 'visitor');
    
    // Si un téléphone est fourni, on le met à jour dans le profil
    if (telephone) {
      try {
        await db.query(
          'UPDATE profiles SET telephone = $1, progression_profile = GREATEST(progression_profile, 25) WHERE user_id = $2',
          [telephone, user.id]
        );
      } catch (error) {
        console.error('Erreur lors de la mise à jour du téléphone:', error);
      }
    }
    
    return user;
  }

  // Ajouter une nouvelle méthode pour mettre à jour les informations utilisateur
  static async updateUserInfo(userEmail, userData) {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;
      
      // Construire la requête dynamiquement en fonction des champs fournis
      if (userData.nom !== undefined) {
        updateFields.push(`nom = $${paramIndex}`);
        values.push(userData.nom);
        paramIndex++;
      }
      
      if (userData.prenom !== undefined) {
        updateFields.push(`prenom = $${paramIndex}`);
        values.push(userData.prenom);
        paramIndex++;
      }
      
      if (userData.email !== undefined) {
        // Vérifier si l'email est déjà utilisé par un autre utilisateur
        if (userData.email !== userEmail) {
          const existingUser = await this.findByEmail(userData.email);
          if (existingUser) {
            throw new Error('Cet email est déjà utilisé par un autre utilisateur');
          }
          
          updateFields.push(`email = $${paramIndex}`);
          values.push(userData.email);
          paramIndex++;
        }
      }
      
      // Si aucun champ à mettre à jour, retourner
      if (updateFields.length === 0) {
        return null;
      }
      
      // Ajouter l'email utilisateur à la fin des valeurs pour la clause WHERE
      values.push(userEmail);
      
      // Exécuter la requête de mise à jour
      const result = await db.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE email = $${paramIndex} RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Erreur dans updateUserInfo:', error);
      throw error;
    }
  }

  async getFullProfile() {
    try {
      // Récupérer les informations de base de l'utilisateur
      const userResult = await db.query(
        'SELECT id, nom, prenom, email, telephone, adresse FROM users WHERE email = $1',
        [this.email]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }

      const userId = userResult.rows[0].id;
      const userData = userResult.rows[0];

      // Récupérer le profil complet avec progression
      const profileResult = await db.query(
        'SELECT * FROM profiles WHERE user_id = $1',
        [userId]
      );

      // Récupérer les formulaires
      const formulairesResult = await db.query(
        'SELECT * FROM formulaires WHERE user_id = $1',
        [userId]
      );

      // Récupérer les documents
      const documentsResult = await db.query(
        'SELECT * FROM documents WHERE user_id = $1',
        [userId]
      );

      // Récupérer les rendez-vous (ici utiliser 'rdv' au lieu de 'rendez_vous')
      const rdvResult = await db.query(
        'SELECT * FROM rdv WHERE user_id = $1',
        [userId]
      );

      // ... reste du code ...

      return {
        informations: userData,
        progression: profileData ? {
          profile: profileData.progression_profile || 0,
          documents: profileData.progression_documents || 0,
          formulaire: profileData.progression_formulaire || 0
        } : {
          profile: 0,
          documents: 0,
          formulaire: 0
        },
        formulaires: formulairesResult.rows,
        documents: documentsResult.rows,
        rendez_vous: rdvResult.rows // garder ce nom pour la compatibilité avec le frontend
      };
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      throw error;
    }
  }
}

module.exports = { User };
