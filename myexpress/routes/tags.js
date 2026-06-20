import express from 'express';
import db from '../db.js';
import { TAG_CATEGORIES, TAG_DEFINITIONS } from '../tagDefinitions.js';

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT id, name_zh, name_en FROM tags', [], (error, rows) => {
    if (error) {
      console.error('GET /api/tags failed:', error.message);
      return res.status(500).json({ message: 'Failed to load tags' });
    }

    const rowsByEnglishName = new Map(rows.map((row) => [row.name_en, row]));
    const missingDefinitions = TAG_DEFINITIONS.filter(
      (definition) => !rowsByEnglishName.has(definition.name_en),
    );

    if (missingDefinitions.length) {
      console.error('GET /api/tags missing predefined tags:', missingDefinitions.map((tag) => tag.name_en));
      return res.status(500).json({ message: 'Predefined tags are not initialized' });
    }

    const items = TAG_DEFINITIONS.map((definition) => ({
      ...rowsByEnglishName.get(definition.name_en),
      category: definition.category,
    }));
    const categories = TAG_CATEGORIES.map((category) => ({
      ...category,
      tags: items.filter((tag) => tag.category === category.key),
    }));

    return res.json({ count: items.length, categories, items });
  });
});

export default router;
