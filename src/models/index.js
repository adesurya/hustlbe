const { sequelize } = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const ProductImage = require('./ProductImage');
const PointTransaction = require('./PointTransaction');
const PointActivity = require('./PointActivity');
const PointRedemption = require('./PointRedemption');

// Define associations

// User associations
User.hasMany(Category, {
  foreignKey: 'createdBy',
  as: 'createdCategories'
});

User.hasMany(Category, {
  foreignKey: 'updatedBy',
  as: 'updatedCategories'
});

User.hasMany(Product, {
  foreignKey: 'createdBy',
  as: 'createdProducts'
});

User.hasMany(Product, {
  foreignKey: 'updatedBy',
  as: 'updatedProducts'
});

User.hasMany(PointTransaction, {
  foreignKey: 'userId',
  as: 'pointTransactions'
});

User.hasMany(PointTransaction, {
  foreignKey: 'processedBy',
  as: 'processedTransactions'
});

User.hasMany(PointRedemption, {
  foreignKey: 'userId',
  as: 'pointRedemptions'
});

User.hasMany(PointRedemption, {
  foreignKey: 'processedBy',
  as: 'processedRedemptions'
});

User.hasMany(PointActivity, {
  foreignKey: 'createdBy',
  as: 'createdActivities'
});

// Category associations
Category.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Category.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

Category.hasMany(Product, {
  foreignKey: 'categoryId',
  as: 'products'
});

// Product associations
Product.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Product.belongsTo(User, {
  foreignKey: 'updatedBy',
  as: 'updater'
});

Product.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category'
});

Product.hasMany(ProductImage, {
  foreignKey: 'productId',
  as: 'images'
});

// ProductImage associations
ProductImage.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product'
});

// PointTransaction associations
PointTransaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

PointTransaction.belongsTo(User, {
  foreignKey: 'processedBy',
  as: 'processor'
});

PointTransaction.belongsTo(PointRedemption, {
  foreignKey: 'referenceId',
  constraints: false,
  scope: {
    referenceType: 'redemption'
  },
  as: 'redemption'
});

// PointActivity associations
PointActivity.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

PointActivity.hasMany(PointTransaction, {
  foreignKey: 'activityType',
  sourceKey: 'activityCode',
  constraints: false,
  as: 'transactions'
});

// PointRedemption associations
PointRedemption.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

PointRedemption.belongsTo(User, {
  foreignKey: 'processedBy',
  as: 'processor'
});

PointRedemption.belongsTo(PointTransaction, {
  foreignKey: 'transactionId',
  as: 'transaction'
});

PointRedemption.hasMany(PointTransaction, {
  foreignKey: 'referenceId',
  constraints: false,
  scope: {
    referenceType: 'redemption'
  },
  as: 'relatedTransactions'
});

// Sync database (optional - only in development)
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
    throw error;
  }
};

// Export all models and utilities
module.exports = {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  PointTransaction,
  PointActivity,
  PointRedemption,
  syncDatabase
};