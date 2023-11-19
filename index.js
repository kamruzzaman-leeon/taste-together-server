const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

// console.log(process.env.ACCESS_TOKEN_SECRET)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jfba5ry.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares
const logger =  (req, res, next) => {
  console.log('log: info', req.method, req.url)
  next();
}


const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('value of token in middleware', token)
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // console.log(err);
      return res.status(403).send({ message: 'Forbidden' })
    }
    console.log('value in the token', decoded)
    req.user = decoded;
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // connect to Atlas cluste & collection
    const FoodCollection = client.db('TasteTogetherDB').collection('food')


    //auth related api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      
      res.cookie('token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'None'
        })
        .send({ success: true });
    })
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user)
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })

    //a new food data create
    app.post('/food', async (req, res) => {
      const newFood = req.body;
      console.log(newFood);
      const result = await FoodCollection.insertOne(newFood);
      res.send(result);
    })

     //all food data read
     app.get('/food', async (req, res) => {
      const cursor = FoodCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    //all food data read
    app.get('/availablefood', async (req, res) => {
      const cursor = FoodCollection.find({fstatus:'available'});
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/fFood', async (req, res) => {
      const cursor = FoodCollection.find({fstatus:'available'});
      cursor.sort({ fquantity: -1 });
      const result = await cursor.toArray();
      // console.log(result)
      res.send(result);
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('taste-together server is running!')
})

app.listen(port, () => {
  console.log(`server is running on port: ${port}`)
})