const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));

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
const logger = (req, res, next) => {
  console.log('log: info', req.method, req.url)
  next();
}


const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of token in middleware', token)
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err.message);
      return res.status(403).send({ message: 'Forbidden' });
    }
    else {
      console.log('value in the token', decoded)
      req.user = decoded;
    }

    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // connect to Atlas cluste & collection
    const FoodCollection = client.db('TasteTogetherDB').collection('food')
    const FoodReqCollection = client.db('TasteTogetherDB').collection('foodreq')
    const FoodBannerCollection = client.db('TasteTogetherDB').collection('banner')

    //auth related api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      console.log('token:', token)
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          // sameSite: 'none'


        })
        .send({ success: true });
    })
    app.post('/logout', async (req, res) => {
      const user = req.body;
      // console.log('logging out', user)
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
    app.get('/food', verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }

      const result = await FoodCollection.find(query).toArray();
      console.log(result)
      res.send(result);
    })

    //food delete
    app.delete('/deletefood/:foodid', verifyToken, async (req, res) => {
      const id = req.params.foodid;
      console.log()
      const result = await FoodCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    //food update
    app.put('/updatefood/:foodid', verifyToken, async (req, res) => {
      const id = req.params.foodid;
      console.log('this is', id)
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateFood = req.body;
      const food = {
        $set: {
          
          fname: updateFood.fname,
          fimage: updateFood.fimage,
          fquantity: updateFood.fquantity,
          fstatus: updateFood.fstatus,
          fplocation: updateFood.fplocation,
          Aditionalinfo: updateFood.Aditionalinfo,
          fexpired: updateFood.fexpired
        },
      }
      const result = await FoodCollection.updateOne(filter, food, options)
      res.send(result)

    })
    app.put('/foodstatusupdate/:foodid', verifyToken, async (req, res) => {
      const id = req.params.foodid;
      console.log('this is', id)
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateFood = req.body;
      console.log(updateFood)
      
      const food = {
        $set: {
          fstatus: updateFood.fstatus,
        },
      };

      const result = await FoodCollection.updateOne(filter, food, options)
      res.send(result)

    })

    //all food data read
    app.get('/availablefood', async (req, res) => {
      let query = { fstatus: 'available' };

      // Condition 1: Both fname and fstatus are mandatory
      if (req.query.fname) {
        query = {
          $and: [
            { fname: { $regex: new RegExp(req.query.fname, 'i') } },
            { fstatus: 'available' }
          ]
        };
      }
      // Condition 2: Only fstatus is mandatory, and sort by fexpired
      // else if (req.query.fstatus) {
      //   query = { fstatus: req.query.fstatus };
      // }

      try {
        let cursor = FoodCollection.find(query);

        // Condition 2: Sort by fexpired if present in the query
        if (req.query.sort === 'asc') {
          cursor = cursor.sort({ fexpired: 1 });
        } else if (req.query.sort === 'desc') {
          cursor = cursor.sort({ fexpired: -1 });
        }

        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching available food:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    app.get('/fFood', async (req, res) => {
      const cursor = FoodCollection.find({ fstatus: 'available' });
      cursor.sort({ fquantity: -1 });
      const result = await cursor.limit(6).toArray();
      // console.log(result)
      res.send(result);
    })


    app.get('/FoodDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await FoodCollection.findOne(query);
      // console.log(result)
      res.send(result)
    })

    app.post('/foodreq', verifyToken, async (req, res) => {
      const newFoodreq = req.body;
      console.log(newFoodreq);
      const result = await FoodReqCollection.insertOne(newFoodreq);
      res.send({ success: true });

    })
    app.get('/foodreq',verifyToken,async(req,res)=>{
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }

      const result = await FoodReqCollection.find(query).toArray();
      console.log(result)
      res.send(result);
    })
    app.delete('/foodreq/:foodid', verifyToken, async (req, res) => {
      const id = req.params.foodid;
      console.log(id)
      const result = await FoodReqCollection.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    //banner get
    app.get('/banner', async (req, res) => {
      const cursor = FoodBannerCollection.find();
      const result = await cursor.toArray();
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