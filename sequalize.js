const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    'admission_db', 
    'postgres', 
    'root', {
  host: 'localhost',
  port: 5432,
  dialect: 'postgres',
});

module.exports = sequelize;