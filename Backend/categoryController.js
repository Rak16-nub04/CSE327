const runtime = require('../config/runtime');
const Category = require('../models/Category');
const JsonCategories = require('../services/jsonCategoryService');

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

// GET /api/categories?type=expense|income
exports.getCategories = async (req, res) => {
  try {
    const type = req.query.type;
    if (type && type !== 'income' && type !== 'expense') {
      return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    }

    if (runtime.storage.mongoConnected) {
      const q = { $or: [{ user: null }, { user: req.user.id }] };
      if (type) q.type = type;
      const categories = await Category.find(q).sort({ type: 1, name: 1 });
      return res.json(categories);
    }

    const categories = await JsonCategories.listForUser(req.user.id, { type });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, type, color, icon } = req.body;

    if (!name || typeof name !== 'string') return res.status(400).json({ message: 'name is required' });
    if (type !== 'income' && type !== 'expense') return res.status(400).json({ message: "type must be 'income' or 'expense'" });
    if (color && !isHexColor(color)) return res.status(400).json({ message: 'color must be a hex code like #3498db' });
    if (icon && typeof icon !== 'string') return res.status(400).json({ message: 'icon must be a string' });

    if (runtime.storage.mongoConnected) {
      const category = await Category.create({
        user: req.user.id,
        name,
        type,
        color: color || '#cccccc',
        icon: icon || 'fa-tag'
      });
      return res.status(201).json(category);
    }

    const category = await JsonCategories.createForUser(req.user.id, { name, type, color, icon });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /api/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (typeof name !== 'undefined' && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'name must be a non-empty string' });
    }
    if (typeof color !== 'undefined' && color !== null && !isHexColor(color)) {
      return res.status(400).json({ message: 'color must be a hex code like #3498db' });
    }
    if (typeof icon !== 'undefined' && icon !== null && typeof icon !== 'string') {
      return res.status(400).json({ message: 'icon must be a string' });
    }

    if (runtime.storage.mongoConnected) {
      const category = await Category.findById(req.params.id);
      if (!category) return res.status(404).json({ message: 'Category not found' });
      if (!category.user || category.user.toString() !== req.user.id) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      if (typeof name === 'string') category.name = name;
      if (typeof color === 'string') category.color = color;
      if (typeof icon === 'string') category.icon = icon;

      const saved = await category.save();
      return res.json(saved);
    }

    const result = await JsonCategories.updateForUser(req.user.id, req.params.id, { name, color, icon });
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Category not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
      return res.status(400).json({ message: 'Failed to update category' });
    }

    res.json(result.category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    if (runtime.storage.mongoConnected) {
      const category = await Category.findById(req.params.id);
      if (!category) return res.status(404).json({ message: 'Category not found' });
      if (!category.user || category.user.toString() !== req.user.id) {
        return res.status(401).json({ message: 'User not authorized' });
      }
      await category.deleteOne();
      return res.json({ id: req.params.id });
    }

    const result = await JsonCategories.deleteForUser(req.user.id, req.params.id);
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ message: 'Category not found' });
      if (result.reason === 'not_authorized') return res.status(401).json({ message: 'User not authorized' });
      return res.status(400).json({ message: 'Failed to delete category' });
    }

    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
