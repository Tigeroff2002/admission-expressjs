const express = require('express');
const { Pool } = require('pg');
const sequalize = require('./sequalize');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

sequalize.authenticate()
    .then(() => console.log('Connection has been established successfully.'))
    .catch(err => console.error('Unable to connect to the database:', err));

const app = express();
const port = 3030;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const Abiturient = require('./models/Abiturient');
const Direction = require('./models/Direction');
const AbiturientDirectionLink = require('./models/AbiturientDirectionLink');

sequalize.sync()
    .then(() => console.log('Tables have been synchronized.'))
    .catch(err => console.error('Error synchronizing tables:', err));

app.post('/register', async (req, res) => {
    try {

        const { email, password, first_name, second_name, is_admin } = req.body;

        const token = uuidv4();

        const abiturient = await Abiturient.create({
            email: email,
            password: password,
            token: token,
            first_name: first_name,
            second_name: second_name,
            is_admin: is_admin,
            has_diplom_original: false
        });
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            is_admin: is_admin, 
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const pool = new Pool({
    user: 'postgres',
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

app.get('/abiturients', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM abiturients');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});