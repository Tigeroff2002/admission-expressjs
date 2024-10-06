const { DataTypes } = require('sequelize');
const sequelize = require('../sequalize');

const AbiturientDirectionLink = sequelize.define('AbiturientDirectionLink', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, 
        allowNull: false,
        unique: true
    },
    abiturient_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    direction_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    place: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    admission_status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'request_in_progress'
    },
    prioritet_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    has_diplom_original: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'abiturient_direction_links',
    timestamps: false
});

module.exports = AbiturientDirectionLink;