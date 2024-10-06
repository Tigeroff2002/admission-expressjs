const express = require('express');
const { Pool } = require('pg');

require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const app = express();
const port = 3030;

app.get('/', (req, res) => {
    res.send('Hello World!');
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