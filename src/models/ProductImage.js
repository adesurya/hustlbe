const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductImage = sequelize.define('ProductImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  imagePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'image_path',
    validate: {
      len: [1, 500],
      notEmpty: true
    }
  },
  altText: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'alt_text',
    validate: {
      len: [0, 200]
    }
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_primary'
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sort_order'
  }
}, {
  tableName: 'product_images',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Only track creation time
  hooks: {
    beforeCreate: async (productImage) => {
      // If this is set as primary, unset other primary images for the same product
      if (productImage.isPrimary) {
        await ProductImage.update(
          { isPrimary: false },
          { where: { productId: productImage.productId } }
        );
      }
    },
    beforeUpdate: async (productImage) => {
      // If this is being set as primary, unset other primary images for the same product
      if (productImage.isPrimary && productImage.changed('isPrimary')) {
        await ProductImage.update(
          { isPrimary: false },
          { 
            where: { 
              productId: productImage.productId,
              id: { [sequelize.Sequelize.Op.ne]: productImage.id }
            } 
          }
        );
      }
    }
  }
});

// Instance methods
ProductImage.prototype.getFullImageUrl = function(baseUrl = '') {
  return `${baseUrl}/uploads/products/${this.imagePath}`;
};

// Static methods
ProductImage.findByProduct = function(productId) {
  return this.findAll({
    where: { productId },
    order: [['isPrimary', 'DESC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']]
  });
};

ProductImage.findPrimaryImage = function(productId) {
  return this.findOne({
    where: { 
      productId,
      isPrimary: true 
    }
  });
};

ProductImage.setPrimaryImage = async function(imageId, productId) {
  // First, unset all primary images for this product
  await this.update(
    { isPrimary: false },
    { where: { productId } }
  );
  
  // Then set the specified image as primary
  return this.update(
    { isPrimary: true },
    { where: { id: imageId, productId } }
  );
};

module.exports = ProductImage;