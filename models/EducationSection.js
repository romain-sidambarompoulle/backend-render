const db = require('../db');

// Modèle pour les sections éducatives
const EducationSection = {
  // Récupérer toutes les sections
  getAll: async () => {
    try {
      const result = await db.query(
        'SELECT * FROM education_sections ORDER BY ordre'
      );
      return { success: true, sections: result.rows };
    } catch (error) {
      console.error('Erreur récupération sections:', error);
      return { success: false, error: error.message };
    }
  },

  // Récupérer une section par ID
  getById: async (id) => {
    try {
      const result = await db.query(
        'SELECT * FROM education_sections WHERE id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return { success: false, error: 'Section non trouvée' };
      }
      return { success: true, section: result.rows[0] };
    } catch (error) {
      console.error('Erreur récupération section:', error);
      return { success: false, error: error.message };
    }
  },

  // Créer une nouvelle section
  create: async (sectionData) => {
    try {
      const { titre, description, ordre, image_url, status } = sectionData;
      const result = await db.query(
        `INSERT INTO education_sections (titre, description, ordre, image_url, status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
         RETURNING *`,
        [titre, description, ordre, image_url, status || 'active']
      );
      return { success: true, section: result.rows[0] };
    } catch (error) {
      console.error('Erreur création section:', error);
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour une section
  update: async (id, sectionData) => {
    try {
      const { titre, description, ordre, image_url, status } = sectionData;
      const result = await db.query(
        `UPDATE education_sections 
         SET titre = $1, description = $2, ordre = $3, image_url = $4, status = $5, updated_at = NOW() 
         WHERE id = $6 
         RETURNING *`,
        [titre, description, ordre, image_url, status, id]
      );
      if (result.rows.length === 0) {
        return { success: false, error: 'Section non trouvée' };
      }
      return { success: true, section: result.rows[0] };
    } catch (error) {
      console.error('Erreur mise à jour section:', error);
      return { success: false, error: error.message };
    }
  },

  // Supprimer une section
  delete: async (id) => {
    try {
      // Vérifier d'abord si des contenus sont associés à cette section
      const checkContents = await db.query(
        'SELECT COUNT(*) FROM educational_content WHERE section_id = $1',
        [id]
      );
      
      if (parseInt(checkContents.rows[0].count) > 0) {
        return { 
          success: false, 
          error: 'Impossible de supprimer cette section car elle contient des contenus éducatifs' 
        };
      }
      
      const result = await db.query(
        'DELETE FROM education_sections WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Section non trouvée' };
      }
      
      return { success: true, message: 'Section supprimée avec succès' };
    } catch (error) {
      console.error('Erreur suppression section:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = EducationSection;
