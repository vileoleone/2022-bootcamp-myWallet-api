import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi"
import { v4 as uuid } from "uuid"
import bcrypt from 'bcryptjs';
import dayjs from "dayjs";
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

const BalanceObjectSchema = joi.object({
    value: joi.number().precision(2).strict().required(),
    description: joi.string().max(15).required(),
    type: joi.string().valid("deposit", "withdrawal").required()
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
        console.log("schema error")
        const errors = error.details.map((detail) => detail.message);
        console.log(error.message)
        return res.status(422).send(errors);
    }

    //checking if there is a name or equal email in database

    try {

        const client_exist = await clientsDataBase.findOne({ name: name })
        const clientEmail_exist = await clientsDataBase.findOne({ email: email })

        if (client_exist) {
            res.status(401).send("the name already exists")
            return
        }

        if (clientEmail_exist) {
            res.status(401).send("the email already exists")
            return
        }

    } catch (error) {
        console.log(error.message)
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
        console.log(error.message)
    }
})

app.post("/sign-in", async (req, res) => {
    const { email, password } = req.body

    try {
        const logInUser = await clientsDataBase.findOne({ email });
        
        if (logInUser && bcrypt.compareSync(password, logInUser.password)) {
            // creating token and inserting in session
            let token;
            const logInUserToken = await db.collection("sessions").findOne({ userId: logInUser._id})
            if (logInUserToken) {
                token = logInUserToken.token
                console.log(token)
            } else {
                token = uuid()
                await db.collection("sessions").insertOne({
                    userId: logInUser._id,
                    token
                })
            }

            
            console.log(token)
            res.status(200).send(token);
        } else {
            res.status(401).send("User or password incorrect");
        }

    } catch (err) {
        console.log(err.message);
        res.sendStatus(530);
    }
});

app.post("/addEntry", async (req, res) => {
    let { value, description } = req.body
    const now = dayjs()
    const body = {
        value: +parseFloat(value).toFixed(2),
        description, 
        type: "deposit"
    }
    //Validating com JOI
    const { error } = BalanceObjectSchema.validate(body, { abortEarly: false })
    if (error) {
        console.log("BalanceObjectSchema error")
        const errors = error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }
    //Getting token to search for correct balance object defined by id
    const { authorization } = req.headers;
    const token = authorization?.replace('Bearer ', '');
    console.log(req.headers)
    if (!token) {
        res.status(401).send("missing token")
        return
    };

    const { userId } = await db.collection("sessions").findOne({ token })

    try {

        BalanceDataBase.insertOne({
            userId,
            value: `${+parseFloat(value).toFixed(2) }`,
            description,
            type: "deposit",
            date: now.format('DD/MM')
            
        })

        res.status(201).send("Transação Adicionada")
    } catch (error) {
        console.log(error)
        res.status(401).send("Id do usuario não encontrado")
    }
})
app.post("/SubtractEntry", async (req, res) => {
    let { value, description } = req.body
    const body = {
        value: +parseFloat(value).toFixed(2),
        description,
        type: "withdrawal"
    }
    //Validating com JOI
    const { error } = BalanceObjectSchema.validate(body, { abortEarly: false })
    if (error) {
        console.log("BalanceObjectSchema error")
        const errors = error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }
    //Getting token to search for correct balance object defined by id
    const { authorization } = req.headers;
    const token = authorization?.replace('Bearer ', '');
    console.log(req.headers)
    if (!token) {
        res.status(401).send("missing token")
        return
    };

    const { userId } = await db.collection("sessions").findOne({ token })

    try {
        const now = dayjs()
        BalanceDataBase.insertOne({
            userId,
            value: `${+parseFloat(value).toFixed(2)}`,
            description,
            type: "withdrawal",
            date: now.format('DD/MM')

        })

        res.status(201).send("Transação Adicionada")
    } catch (error) {
        console.log(error)
        res.status(401).send("Id do usuario não encontrado")
    }
})

app.get("/MainPage", async (req, res) => {

    // Validating with token
    const { authorization } = req.headers;
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
    const correspondingBalance = await BalanceDataBase.find({
        userId: session.userId
    }).toArray()

    if (correspondingBalance) {
        // returning to front-end the complete wallet
        res.send(correspondingBalance)
        return
    }

    else {
        res.status(401).send("Balance not found")
        return;
    }
});


app.listen(5000, () => console.log("running in port 5000"))