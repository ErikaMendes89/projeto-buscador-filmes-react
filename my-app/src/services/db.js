const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();
const port = 5000;

const url = 'mongodb://localhost:27017';
const dbName = 'movieapp';
let db;

( async () => {
    if (db) return db; 
    try {
        const client = new MongoClient(url, { useNewUrlParser: true});
        await client.connect();
        db = client.db(dbName);
        console.log('Conectado ao MongoDB');
        return db;
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB', err);
        process.exit(1);
    }
    
})();


app.use(cors());
app.use(express.json());


app.post('/favorites', async (req, res) => {
    const movie = req.body;
    try {
        const existingMovie = await db.collection('favorites').findOne({ id:movie.id});
        if (!existingMovie) {
            await db.collection('favorites').insertOne(movie);
            res.status(201).send('Filme adicionado aos favoritos!');
        } else {
            res.status(409).send('Filme já está nos favoritos!');
        }
    } catch (error) {
        res.status(500).send('Erro ao adicionar o filme aos favoritos!');
    }
});


app.delete('/favorites/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.collection('favorites').deleteOne({id: parseInt(id)});
        if (result.deletedCount > 0) {
            res.status(200).send('Filme removido dos favoritos!');
        } else {
            res.status(404).send('Filme não encontrado nos favoritos!');
        }
    } catch (error) {
        res.status(500).send('Erro ao remover o filme dos favoritos!');
    }
});


app.get('/favorites', async (req, res) => {
    try {
        const favorites = await db.collection('favorites').find().toArray();
        res.status(200).json(favorites);
    } catch (error) {
        res.status(500).send('Erro ao buscar os favoritos!');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

