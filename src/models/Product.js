const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [2, 200],
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(220),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 220],
      is: /^[a-z0-9-]+$/i
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      isInt: true
    }
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500],
      isUrl: true
    }
  },
  image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'category_id',
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_featured'
  },
  stockQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'stock_quantity',
    validate: {
      min: 0,
      isInt: true
    }
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count',
    validate: {
      min: 0,
      isInt: true
    }
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order'
  },
  metaTitle: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'meta_title',
    validate: {
      len: [0, 200]
    }
  },
  metaDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'meta_description'
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
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (product) => {
      // Generate slug from title if not provided
      if (product.title && !product.slug) {
        product.slug = product.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');
      }
      
      // Generate meta title from title if not provided
      if (product.title && !product.metaTitle) {
        product.metaTitle = product.title.length > 200 
          ? product.title.substring(0, 197) + '...'
          : product.title;
      }
    }
  }
});

// Instance methods
Product.prototype.toSafeJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Format price for display
  values.formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(values.price);
  
  return values;
};

Product.prototype.incrementViewCount = async function() {
  return this.increment('viewCount');
};

Product.prototype.updateStock = async function(quantity) {
  if (this.stockQuantity + quantity < 0) {
    throw new Error('Insufficient stock');
  }
  return this.increment('stockQuantity', { by: quantity });
};

// Static methods
Product.findActiveProducts = function(options = {}) {
  const Category = require('./Category');
  
  return this.findAll({
    where: { isActive: true },
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name', 'slug'],
      where: { isActive: true }
    }],
    order: [['sortOrder', 'ASC'], ['created_at', 'DESC']],
    ...options
  });
};

Product.findBySlug = function(slug, includeCategory = true) {
  const includeOptions = [];
  
  if (includeCategory) {
    const Category = require('./Category');
    includeOptions.push({
      model: Category,
      as: 'category',
      attributes: ['id', 'name', 'slug']
    });
  }
  
  return this.findOne({
    where: { slug, isActive: true },
    include: includeOptions
  });
};

Product.findFeaturedProducts = function(limit = 10) {
  const Category = require('./Category');
  
  return this.findAll({
    where: { 
      isActive: true,
      isFeatured: true 
    },
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name', 'slug'],
      where: { isActive: true }
    }],
    order: [['sortOrder', 'ASC'], ['viewCount', 'DESC']],
    limit
  });
};

Product.findByCategory = function(categoryId, options = {}) {
  return this.findActiveProducts({
    where: { categoryId },
    ...options
  });
};

Product.searchProducts = function(query, options = {}) {
  const Category = require('./Category');
  const { Op } = sequelize.Sequelize;
  
  return this.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { title: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { metaTitle: { [Op.like]: `%${query}%` } }
      ]
    },
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name', 'slug'],
      where: { isActive: true }
    }],
    order: [['viewCount', 'DESC'], ['created_at', 'DESC']],
    ...options
  });
};

module.exports = Product;