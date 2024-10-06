const { DataTypes } = require('sequelize');
const sequelize = require('../sequalize');

const Direction = sequelize.define('Direction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, 
        allowNull: false,
        unique: true
    },
    caption: {
        type: DataTypes.STRING,
        allowNull: false
    },
    budget_places_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    min_ball: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    is_filled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    is_finalized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'directions',
    timestamps: false
});

module.exports = Direction;