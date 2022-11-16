import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi"
import { v4 as uuid } from "uuid"
import bcrypt from 'bcryptjs';
//setup for extenal dependencies used in this projectconfiguring dotenv
dotenv.config();
//initial configuration for mongoDb server
const app = express()
app.use(cors());
app.use(express.json());

//setup for MongoDB server

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
let WalletDatabase;
let clientsDataBase;
let BalanceDataBase;
// joi validations 

const registerSchema = joi.object({
    name: joi.string().min(3).max(10).required(),
    email: joi.string().email().required(),
    password: joi.string().min(3).max(15).required(),
    password_confirmation: joi.any().valid(joi.ref('password')).required()
})

// connecting with mongoDb 

mongoClient.connect(() => {
    db = mongoClient.db("WalletMockServer")
    clientsDataBase = db.collection("WalletMockServer_Client")
    BalanceDataBase = db.collection("WalletMockServer_Balance")
    console.log("connected with database")
})

app.post("/sign-up", async (req, res) => {

    const { name, email, password, password_confirmation } = req.body

    //validation of fields

    const { error } = registerSchema.validate(req.body, { abortEarly: false })
    if (error) {
        const errors = error.details.map((detail) => detail.message);
        console.log(error)
        return res.status(422).send(errors);
    }

    //checking if there is a name or equal email in database

    try {

        const client_exist = await clientsDataBase.findOne({ name: name })
        const clientEmail_exist = await clientsDataBase.findOne({ email: ElementInternals })

        if (client_exist) {
            res.status(401).send("the name already exists")
            return
        }

        if (clientEmail_exist) {
            res.status(401).send("the email already exists")
            return
        }

    } catch (error) {
        console.log(error)
    }

    // encrypting user's password
    const hash = bcrypt.hashSync(password, 10)

    // inserting in database

    try {
        clientsDataBase.insertOne({
            name,
            email,
            password: hash,
        })
        res.status(201).send("User registered")
    } catch (error) {
        console.log(error)
    }
})

app.post("/sign-in", async (req, res) => {
    const { email, password } = req.body

    try {
        const logInUser = await clientsDataBase.findOne({ email });
        if (logInUser && bcrypt.compareSync(password, logInUser.password)) {

            // creating token and inserting in session
            const token = uuid()

            await db.collection("sessions").insertOne({
                userId: logInUser._id,
                token
            })

            res.status(200).send(token);
        } else {
            res.status(401).send("User or password incorrect");
        }
    } catch (err) {
        console.log(err);
        res.sendStatus(530);
    }
});


app.get("/wallet", async (req, res) => {

    // Validating with token
    const { authorization } = req.header;
    const token = authorization?.replace('Bearer ', '');

    if (!token) {
        res.status(401).send("missing token")
        return
    };
    
    //creating session for learning purposes
    const session = await db.collection("sessions").findOne({ token });

    if (!session) {
        res.sendStatus(401)
        return;
    }

    // finally searching for user  balance
    const correspondingBalance = await BalanceDataBase.findOne({
        _id: session.userId
    })



    if (correspondingBalance) {
        // returning to front-end the complete wallet
        const userBalance = BalanceDataBase.find({ _id: correspondingBalance._id }).toArray()
        
        //optional
        delete userBalance._id

        res.send(userBalance)
        return
    }
    
    else {
        res.status(401).send("Balance not found")
            return;
    }
});


app.listen(5000, () => console.log("running in port 5000"))