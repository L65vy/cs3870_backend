import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import { MongoClient } from "mongodb";

// Load environment variables FIRST
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "https://L65vy.github.io",
      "https://l65vy.github.io",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "DELETE"],
  })
);
app.use(express.json()); // replaces body-parser

// Server configuration
const PORT = process.env.PORT ?? 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI;
const DBNAME = process.env.DBNAME;
const COLLECTION = process.env.COLLECTION;

const client = new MongoClient(MONGO_URI);
const db = client.db(DBNAME);

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});

// --- Get endpoints ----

//"contacts" route
app.get("/contacts", async (req, res) => {
  await client.connect();
  console.log("Node connected successfully to GET MongoDB");
  const query = {};
  const results = await db
    .collection(COLLECTION)
    .find(query)
    .limit(100)
    .toArray();
  console.log(results);
  res.status(200);
  // res.send(results);
  res.json(results);
});

app.get("/name", (req, res) => {
  res.send("My name is Levi");
} );

//"contacts/<name>" route (Can specify a key to look for, 'name' in this case, and search for only values associated with the key)
app.get("/contacts/:name", async (req, res) => {
  const contactName = decodeURIComponent(req.params.name); // Decode the name parameter
  console.log("Contact to find:", contactName);
  
  await client.connect();
  console.log("Node connected successfully to GET-id MongoDB");
  
  const query = { contact_name: contactName }; // Use the decoded name to query database
  const result = await db.collection(COLLECTION).findOne(query);
  
  console.log("Results:", result);
  if (!result) {
    res.status(404).send("Not Found");
  } else {
    res.status(200).json(result);
  }
});

/// --- Post Endpoints ---

app.post("/contacts", async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).send({ message: "Bad request: No data provided." });
  }

  const { contact_name, phone_number, message, image_url } = req.body;

  try {
    const existingContact = await db
      .collection(COLLECTION)
      .findOne({ contact_name });
    if (existingContact) {
      return res
        .status(409)
        .json({
          message: `Contact with name '${contact_name}' already exists.`,
        });
    }

    const newDocument = { contact_name, phone_number, message, image_url };
    await db.collection(COLLECTION).insertOne(newDocument);
    res.status(201).json({ message: "New contact added successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add contact: " + error.message });
  }
});

/// --- Delete Endpoints ---

app.delete("/contacts/:name", async (req, res) => {
    try {
        // Read parameter name
        const name = req.params.name;
        console.log("Contact to delete:", name);
        
        // Connect to MongoDB
        await client.connect();
        console.log("Node connected successfully to DELETE MongoDB");
        
        // Reference collection
        const contactsCollection = db.collection(COLLECTION); // Use 'collection' instead of 'COLLECTION'
        
        // Check if contact already exists
        const existingContact = await contactsCollection.findOne({ contact_name: name });
        if (!existingContact) {
            return res.status(404).json({
                message: `Contact with name ${name} does NOT exist.`,
            });
        }

        // Define query
        const query = { contact_name: name };
        
        // Delete one contact
        const results = await contactsCollection.deleteOne(query);
        
        // Response to Client
        res.status(200).send({ message: `Contact ${name} was DELETED successfully.` });
    } catch (error) {
        console.error("Error deleting contact:", error);
        res.status(500).send({ message: 'Internal Server Error: ' + error.message });
    }
});
