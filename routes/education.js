const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const EducationSection = require('../models/EducationSection');
const EducationalContent = require('../models/EducationalContent');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const pool = require('../db');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// ==================== ROUTES SECTIONS ====================

// Récupérer toutes les sections (publique)
router.get('/sections', async (req, res) => {
  try {
    const result = await EducationSection.getAll();
    if (result.success) {
      return res.json({
        success: true,
        sections: result.sections
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route GET sections:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Récupérer une section par ID (publique)
router.get('/sections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await EducationSection.getById(id);
    
    if (result.success) {
      // Récupérer aussi les contenus de cette section
      const contentsResult = await EducationalContent.getBySectionId(id);
      
      return res.json({
        success: true,
        section: result.section,
        contents: contentsResult.success ? contentsResult.contents : []
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route GET section par ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Créer une section (admin seulement)
router.post('/sections', verifyToken, isAdmin, async (req, res) => {
  try {
    const sectionData = req.body;
    
    // Validation basique
    if (!sectionData.titre) {
      return res.status(400).json({
        success: false,
        message: 'Le titre est requis'
      });
    }
    
    const result = await EducationSection.create(sectionData);
    
    if (result.success) {
      return res.status(201).json({
        success: true,
        section: result.section
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route POST section:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Mettre à jour une section (admin seulement)
router.put('/sections/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const sectionData = req.body;
    
    // Validation basique
    if (!sectionData.titre) {
      return res.status(400).json({
        success: false,
        message: 'Le titre est requis'
      });
    }
    
    const result = await EducationSection.update(id, sectionData);
    
    if (result.success) {
      return res.json({
        success: true,
        section: result.section
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route PUT section:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Supprimer une section (admin seulement)
router.delete('/sections/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await EducationSection.delete(id);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route DELETE section:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ==================== ROUTES CONTENUS ÉDUCATIFS ====================

// Récupérer tous les contenus (publique)
router.get('/contents', async (req, res) => {
  try {
    const result = await EducationalContent.getAll();
    if (result.success) {
      return res.json({
        success: true,
        contents: result.contents
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route GET contents:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Récupérer un contenu par ID (publique)
router.get('/contents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await EducationalContent.getById(id);
    
    if (result.success) {
      return res.json({
        success: true,
        content: result.content
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route GET content par ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Créer un contenu (admin seulement)
router.post('/contents', verifyToken, isAdmin, async (req, res) => {
  try {
    const { titre, description, contenu, section_id, ordre, temps_lecture, image_url, type, status } = req.body;
    
    // Nettoyer le HTML du contenu
    const sanitizedContent = contenu ? DOMPurify.sanitize(contenu) : '';
    
    // Insertion avec le contenu nettoyé
    const result = await EducationalContent.create({
      titre,
      description,
      contenu: sanitizedContent,
      section_id,
      ordre,
      temps_lecture,
      image_url,
      type,
      status
    });
    
    if (result.success) {
      return res.status(201).json({
        success: true,
        content: result.content
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route POST content:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Mettre à jour un contenu (admin seulement)
router.put('/contents/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, contenu, section_id, ordre, temps_lecture, image_url, type, status } = req.body;
    
    // Nettoyer le HTML du contenu
    const sanitizedContent = contenu ? DOMPurify.sanitize(contenu) : '';
    
    // Vérifier d'abord si le contenu existe
    const contentCheck = await EducationalContent.getById(id);
    if (!contentCheck.success) {
      return res.status(404).json({
        success: false,
        message: 'Contenu non trouvé'
      });
    }
    
    // Requête SQL directe pour la mise à jour
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
      titre,
      description,
      sanitizedContent,
      section_id,
      ordre || 0,
      temps_lecture || 5,
      image_url || null,
      type || 'text',
      status || 'active',
      id
    ];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Échec de la mise à jour du contenu'
      });
    }
    
    return res.json({
      success: true,
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur route PUT content:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Supprimer un contenu (admin seulement)
router.delete('/contents/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await EducationalContent.delete(id);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Erreur route DELETE content:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;
