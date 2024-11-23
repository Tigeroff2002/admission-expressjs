const express = require('express');
const { Pool } = require('pg');
const sequalize = require('./sequalize');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');

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

// register
app.post('/register', async (req, res) => {
    try {

        const { email, password, first_name, second_name, is_admin } = req.body;

        const token = uuidv4();

        const existed_abiturient = await Abiturient.findOne({
            where: {
                email: email
            }
        });

        if (existed_abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with such email already existed" 
                });
        }

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

// login
app.post('/login', async (req, res) => {
    try {

        const { email, password } = req.body;

        const token = uuidv4();

        const abiturient = await Abiturient.findOne({
            where: {
                email: email
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such email not already existed" 
            });
        }

        if (abiturient.password !== password) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "Passwords not equals" 
            });
        }

        abiturient.token = token;

        await abiturient.save();
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            is_admin: abiturient.is_admin, 
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// logout
app.post('/logout', async (req, res) => {
    try {

        const { abiturient_id, token } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such id not already existed" 
            });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "Tokens not equals. Go to login page" 
            });
        }
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get lk content
app.post('/lk', async (req, res) => {
    try {

        const { abiturient_id, token } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such id not already existed" 
            });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        const directions_links_db = await AbiturientDirectionLink.findAll(
            {
                where: {
                    abiturient_id: abiturient_id
                }
            }
        );

        var directions_links = [];

        if (!directions_links_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No directions links found" 
                });            
        }

        await Promise.all(directions_links_db.map(async (current_item) => {
            const direction_id = current_item.direction_id;

            const direction = await Direction.findOne({
                where: {
                    id: direction_id
                }
            });

            if (!direction){
                return res.status(400).json(
                    { 
                        content: null, 
                        result: false, 
                        failure_message: "No direction with id" + direction_id + " found" 
                    });                     
            }

            directions_links.push({
                direction_id: direction_id,
                direction_caption: direction.caption,
                place: current_item.place,
                mark: current_item.mark,
                admission_status: current_item.admission_status,
                priotitet_number: current_item.prioritet_number
            });
        }));

        directions_links.sort((a, b) => {
            if (a.priotitet_number > b.prioritet_number) return -1;

            if (a.priotitet_number < b.prioritet_number) return 1;

            return 0;
        });

        const content = {
            first_name: abiturient.first_name,
            second_name: abiturient.second_name,
            email: abiturient.email,
            has_diplom_original: abiturient.has_diplom_original,
            is_enrolled: abiturient.is_enrolled,
            directions_links: directions_links
        };
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            content: content, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get all directions
app.post('/directions', async (req, res) => {
    try {

        const { abiturient_id, token } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such id not already existed" 
            });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        const directions_db = await Direction.findAll();

        if (!directions_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No directions found" 
                });            
        }

        var directions = [];

        directions_db.forEach(current_item => {
            const directionLink = {
                direction_id: current_item.id,
                direction_caption: current_item.caption
            };

            directions.push(directionLink);
        });

        const content = {
            directions: directions
        };
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            content: content, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get direction info
app.post('/direction', async (req, res) => {
    try {

        const { abiturient_id, token, direction_id } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such id not already existed" 
            });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        const direction_db = await Direction.findOne({
            where: {
                id: direction_id
            }
        });

        if (!direction_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No direction with id " + direction_id + " found" 
                });            
        }

        const places_db = await AbiturientDirectionLink.findAll({
            where : {
                direction_id: direction_id
            }
        });

        var places = [];

        await Promise.all(places_db.map(async (current_item) => {
            const abiturient = await Abiturient.findOne({
                where : {
                    id: current_item.abiturient_id
                }
            });

            if (!abiturient){
                return res.status(400).json(
                    { 
                        content: null, 
                        result: false, 
                        failure_message: "No abiturient with id " + current_item.abiturient_id + " found" 
                    });            
            }

            const place = {
                place: current_item.place,
                abiturient_id: current_item.abiturient_id,
                abiturient_name: abiturient.first_name + " " + abiturient.second_name,
                mark: current_item.mark,
                admission_status: current_item.admission_status,
                priotitet_number: current_item.prioritet_number,
                has_diplom_original: current_item.has_diplom_original
            };

            places.push(place);
        }));

        const placesContent = {
            direction_id: direction_id,
            direction_caption: direction_db.caption,
            budget_places_number: direction_db.budget_places_number,
            min_ball : direction_db.min_ball,
            places: places
        };
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            content: placesContent, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// add new direction
app.post('/directions/addNew', async (req, res) => {
    try {

        const { abiturient_id, token, direction_caption, budget_places_number, min_ball } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const existed_direction = await Direction.findOne({
            where : {
                caption: direction_caption
            }
        });

        if (existed_direction) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Direction with caption " + direction_caption + " already exists"
                });
        }      

        const direction = await Direction.create({
            caption: direction_caption,
            budget_places_number: budget_places_number,
            min_ball: min_ball,
            is_filled: false,
            is_finalized: false
        });
        
        return res.status(200).json({ 
            abiturient_id: abiturient.id, 
            token: token, 
            direction_id: direction.id,
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// add abiturient links
app.post('/abiturients/addInfo', async (req, res) => {
    try {

        const { abiturient_id, token, content } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const target_abiturient_id = content.target_abiturient_id;

        const target_abiturient = await Abiturient.findOne({
            where : {
                id: target_abiturient_id
            }
        });

        if (!target_abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + target_abiturient_id + " not already existed" 
                });
        }

        if (target_abiturient.is_requested) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + target_abiturient_id + " is already requested" 
                });
        }
       
        target_abiturient.has_diplom_original = content.has_diplom_original;

        const directions_links = content.directions_links;

        await Promise.all(directions_links.map(async (link) => {
            const direction_id = link.direction_id;

            const existed_direction = await Direction.findOne({
                id: direction_id
            });

            if (!existed_direction) {
                return res.status(400).json(
                    { 
                        content: null, 
                        result: false, 
                        failure_message: "Direction with id " + direction_id + " not already existed" 
                    });
            }    
            
            await AbiturientDirectionLink.create({
                abiturient_id: target_abiturient_id,
                direction_id: direction_id,
                place: 0,
                mark: 0,
                admission_status: 'request_in_progress',
                prioritet_number: link.prioritet_number,
                has_diplom_original: content.has_diplom_original
            });
        }));

        target_abiturient.is_requested = true;

        await target_abiturient.save();
        
        return res.status(200).json({
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// add original diplom
app.post('/abiturients/addOriginalDiplom', async (req, res) => {
    try {

        const { abiturient_id, token, target_abiturient_id, has_diplom_original } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const target_abiturient = await Abiturient.findOne({
            where : {
                id: target_abiturient_id
            }
        });

        if (!target_abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + target_abiturient_id + " not already existed" 
                });
        }

        if (!target_abiturient.is_requested) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + target_abiturient_id + " was not already requested" 
                });
        }
       
        target_abiturient.has_diplom_original = content.has_diplom_original;

        await target_abiturient.save();
        
        return res.status(200).json({
            content: null, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get all abiturients
app.post('/abiturients/all', async (req, res) => {
    try {

        const { abiturient_id, token } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const abiturients_db = await Abiturient.findAll();

        var abiturients = [];

        abiturients_db.forEach(current_item => {
            if (!current_item.is_admin){
                abiturients.push({
                    abiturient_id: current_item.id,
                    abiturient_name: current_item.first_name + " " + current_item.second_name,
                    is_requested: current_item.is_requested,
                    is_enrolled: current_item.is_enrolled,
                    has_diplom_original: current_item.has_diplom_original
                });
            }
        });

        var content = {
            abiturients: abiturients
        };
        
        return res.status(200).json({
            abiturient_id: abiturient_id,
            token: token,
            content: content, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get enrolled abiturients
app.post('/abiturients/all', async (req, res) => {
    try {

        const { abiturient_id, token } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const abiturients_db = await Abiturient.findAll({
            where: {
                is_enrolled: true
            }
        });

        var abiturients = [];

        abiturients_db.forEach(current_item => {
            if (!current_item.is_admin){
                abiturients.push({
                    abiturient_id: current_item.id,
                    abiturient_name: current_item.first_name + " " + current_item.second_name,
                    is_requested: current_item.is_requested,
                    is_enrolled: current_item.is_enrolled,
                    has_diplom_original: current_item.has_diplom_original
                });
            }
        });

        var content = {
            abiturients: abiturients
        };
        
        return res.status(200).json({
            abiturient_id: abiturient_id,
            token: token,
            content: content, 
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// get direction snapshot file
app.post('/directions/getEmptySnapshot', async (req, res) => {
    try {

        const { abiturient_id, token, direction_id } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const direction_db = await Direction.findOne({
            where: {
                id: direction_id
            }
        });

        if (!direction_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No direction with id " + direction_id + " found" 
                });            
        }
        
        const places_db = await AbiturientDirectionLink.findAll({
            where : {
                direction_id: direction_id
            }
        });

        var places = [];

        await Promise.all(places_db.map(async (current_item) => {
            const current_abiturient = await Abiturient.findOne({
                where : {
                    id : current_item.abiturient_id
                }
            });

            if (!current_abiturient){
                return res.status(400).json(
                    { 
                        content: null, 
                        result: false, 
                        failure_message: "No abiturient with id " + current_item.abiturient_id + " found" 
                    });            
            }  
            
            places.push({
                abiturient_id: current_abiturient.id,
                abiturient_name: current_abiturient.first_name + " " + current_abiturient.second_name,
                mark: current_item.mark
            });
        }));

        const csv_columns = ['id', 'name', 'mark'];

        const parser = new Parser({csv_columns});

        const csv = parser.parse(places);

        res.header('Content-Type', 'text/csv');
        res.attachment('empty_marks_' + direction_db.caption + '.csv');
        res.send(csv);
        
        return res;
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const upload = multer({ dest: 'uploads/' });

const pool = new Pool({
    user: 'postgres',
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// /directions/fillMarks
/*
curl -X POST http://localhost:3030/directions/fillMarks \
     -F 'csv=@./csv_marks.csv' \
     -F 'abiturient_id=1' \
     -F 'token=your_token' \
     -F 'direction_id=2'
*/
app.post('/directions/fillMarks', upload.single('csv'), async (req, res) => {
    try {
        const abiturient_id = req.body.abiturient_id;
        const token = req.body.token;
        const direction_id = req.body.direction_id;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id " + abiturient_id + " not already existed" 
                });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        if (!abiturient.is_admin) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "User with id" + abiturient_id + " has not admin privilegies"
                });
        }

        const direction_db = await Direction.findOne({
            where: {
                id: direction_id
            }
        });

        if (!direction_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No direction with id " + direction_id + " found" 
                });            
        }

        if (direction_db.is_filled){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Direction with id " + direction_id + " already filled" 
                });            
        }

        if (req.file){
            const filePath = req.file.path;

            var receivedMarks = [];

            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    receivedMarks.push({
                        abiturient_id: row.abiturient_id,
                        mark: row.mark
                    });
                })
                .on('end', () => {
                    fs.unlinkSync(filePath);
                })
                .on('error', (error) => {
                    console.error("Error parsing CSV:", error);
                    res.status(500).send("Error parsing CSV file");
                });
            } else {
                res.status(400).send("No file uploaded");       
            }   

        const places_db = await AbiturientDirectionLink.findAll({
            where: {
                direction_id: direction_id
            }
        });

        var is_request_validated = true;

        receivedMarks.forEach(newMark => {
            var abiturientExisted = false;

            places_db.forEach(db_place => {
                if (db_place.abiturient_id === newMark.abiturient_id){
                    abiturientExisted = true;
                }
            });

            if (!abiturientExisted){
                is_request_validated = false;
            }
        });

        if (is_request_validated){
            var newAbiturients = [];

            places_db.forEach(places_db => {
                receivedMarks.forEach(newMark => {
                    if (db_place.abiturient_id === newMark.abiturient_id){
                        db_place.mark = newMark.mark;
                    }
                });
            });

            newAbiturients.push(db_place);

            newAbiturients.sort((a, b) => {
                if (a.mark < b.mark) return -1;
    
                if (a.mark > b.mark) return 1;
    
                return 0;
            });
    
            await pool.query(
                'delete from abiturient_direction_links where direction_id = ?',
                [direction_id]);
                
            var place_number = 1;
    
            await Promise.all(newAbiturients.map(async (newAbiturient) => {
                await AbiturientDirectionLink.create({
                    abiturient_id: newAbiturient.abiturient_id,
                    direction_id: newAbiturient.direction_id,
                    mark: newAbiturient.mark,
                    place_number,
                    admission_status: newAbiturient.admission_status,
                    prioritet_number: newAbiturient.prioritet_number,
                    has_diplom_original: newAbiturient.has_diplom_original
                });
    
                place_number += 1;
            }));
    
            direction_db.is_filled = true;
    
            await direction_db.save();
            
            return res.status(200).json({
                content: null, 
                failure_message: null,
                result: true
            });
        }
        else {
            res.status(500).json(
                {
                    content: null,
                    result: false,
                    failure_message: "Some abiturients from input list are not existed"
                });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// /directions/finalize
app.post('/directions/finalize', async (req, res) => {
    try {

        const { abiturient_id, token, direction_id } = req.body;

        const abiturient = await Abiturient.findOne({
            where: {
                id: abiturient_id
            }
        });

        if (!abiturient) {
            return res.status(400).json(
            { 
                content: null, 
                result: false, 
                failure_message: "User with such id not already existed" 
            });
        }

        if (abiturient.token !== token) {
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Tokens not equals. Go to login page" 
                });
        }

        const direction_db = await Direction.findOne({
            where: {
                id: direction_id
            }
        });

        if (!direction_db){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "No direction with id " + direction_id + " found" 
                });            
        }

        if (!direction_db.is_filled){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Direction with id " + direction_id + " is not already filled" 
                });            
        }        

        if (direction_db.is_finalized){
            return res.status(400).json(
                { 
                    content: null, 
                    result: false, 
                    failure_message: "Direction with id " + direction_id + " is already finalized" 
                });            
        }     

        const db_places = await AbiturientDirectionLink.findAll({
            where : {
                direction_id : direction_id
            }
        });

        var number = 0;
        var minBall = direction_db.min_ball;
        var budget_places_number = direction_db.budget_places_number;

        await Promise.all(db_places.map(async (current_place) => {
            if (current_place.has_diplom_original 
                && current_place.mark >= minBall
                && number < budget_places_number){
                    current_place.admission_status = "enrolled";
                    number += 1;
            }

            var relatedAbiturient = await Abiturient.findOne({
                where : {
                    id: current_place.abiturient_id
                }
            });

            if (!relatedAbiturient){
                return res.status(400).json(
                    { 
                        content: null, 
                        result: false, 
                        failure_message: "Abiturient with id " + current_place.abiturient_id + " not exists" 
                    });            
            }
            
            relatedAbiturient.is_enrolled = true;

            await current_place.save();

            await relatedAbiturient.save();
        }));

        direction_db.is_finalized = true;

        await direction_db.save();

        return res.status(200).json({ 
            content: null,
            failure_message: null, 
            result: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});