const db = require('../db');

// Modèle pour le contenu éducatif
const EducationalContent = {
  // Récupérer tous les contenus
  getAll: async () => {
    try {
      const result = await db.query(
        `SELECT ec.*, es.titre as section_titre 
         FROM educational_content ec
         JOIN education_sections es ON ec.section_id = es.id
         ORDER BY ec.ordre`
      );
      return { success: true, contents: result.rows };
    } catch (error) {
      console.error('Erreur récupération contenus:', error);
      return { success: false, error: error.message };
    }
  },

  // Récupérer les contenus d'une section
  getBySectionId: async (sectionId) => {
    try {
      const result = await db.query(
        `SELECT * FROM educational_content 
         WHERE section_id = $1 
         ORDER BY ordre`,
        [sectionId]
      );
      return { success: true, contents: result.rows };
    } catch (error) {
      console.error('Erreur récupération contenus de section:', error);
      return { success: false, error: error.message };
    }
  },

  // Récupérer un contenu par ID
  getById: async (id) => {
    try {
      const result = await db.query(
        `SELECT ec.*, es.titre as section_titre 
         FROM educational_content ec
         JOIN education_sections es ON ec.section_id = es.id
         WHERE ec.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return { success: false, error: 'Contenu non trouvé' };
      }
      return { success: true, content: result.rows[0] };
    } catch (error) {
      console.error('Erreur récupération contenu:', error);
      return { success: false, error: error.message };
    }
  },

  // Créer un nouveau contenu
  create: async (contentData) => {
    try {
      const { 
        titre, 
        description, 
        contenu, 
        section_id, 
        ordre, 
        temps_lecture, 
        image_url, 
        type,
        status 
      } = contentData;
      
      const result = await db.query(
        `INSERT INTO educational_content (
          titre, description, contenu, section_id, ordre, 
          temps_lecture, image_url, type, status, created_at, updated_at
        ) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
         RETURNING *`,
        [
          titre, 
          description, 
          contenu, 
          section_id, 
          ordre, 
          temps_lecture || 5, 
          image_url,
          type || 'text',
          status || 'active'
        ]
      );
      return { success: true, content: result.rows[0] };
    } catch (error) {
      console.error('Erreur création contenu:', error);
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour un contenu
  update: async (contentData, options) => {
    try {
      const { id } = options.where;
      
      // Vérifier si le contenu existe
      const content = await this.getById(id);
      if (!content.success) {
        return {
          success: false,
          error: 'Contenu non trouvé'
        };
      }
      
      // Mise à jour du contenu
      const query = `
        UPDATE educational_content 
        SET 
          titre = $1,
          description = $2,
          contenu = $3,
          section_id = $4,
          ordre = $5,
          temps_lecture = $6,
          image_url = $7,
          type = $8,
          status = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `;
      
      const values = [
        contentData.titre,
        contentData.description,
        contentData.contenu,
        contentData.section_id,
        contentData.ordre || 0,
        contentData.temps_lecture || 5,
        contentData.image_url || null,
        contentData.type || 'text',
        contentData.status || 'active',
        id
      ];
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Échec de la mise à jour du contenu'
        };
      }
      
      return {
        success: true,
        content: result.rows[0]
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contenu:', error);
      return {
        success: false,
        error: 'Erreur serveur lors de la mise à jour'
      };
    }
  },

  // Supprimer un contenu
  delete: async (id) => {
    try {
      const result = await db.query(
        'DELETE FROM educational_content WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Contenu non trouvé' };
      }
      
      return { success: true, message: 'Contenu supprimé avec succès' };
    } catch (error) {
      console.error('Erreur suppression contenu:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = EducationalContent;
