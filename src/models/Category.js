const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 100],
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 120],
      is: /^[a-z0-9-]+$/i
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by'
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'updated_by'
  }
}, {
  tableName: 'categories',
  timestamps: true,
  paranoid: true, // Enable soft delete
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at', // Specify the deletedAt field
  hooks: {
    beforeValidate: (category) => {
      // Generate slug from name if not provided
      if (category.name && !category.slug) {
        category.slug = category.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');
      }
    }
  }
});

// Instance methods
Category.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  return values;
};

// Static methods
Category.findActiveCategories = function(options = {}) {
  return this.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    ...options
  });
};

Category.findBySlug = function(slug) {
  return this.findOne({
    where: { slug, isActive: true }
  });
};

Category.findWithProductCount = function(options = {}) {
  const Product = require('./Product');
  
  return this.findAll({
    attributes: {
      include: [
        [
          sequelize.fn('COUNT', sequelize.col('Products.id')),
          'productCount'
        ]
      ]
    },
    include: [{
      model: Product,
      attributes: [],
      required: false,
      where: { isActive: true }
    }],
    group: ['Category.id'],
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    ...options
  });
};

module.exports = Category;