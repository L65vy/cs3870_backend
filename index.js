import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import { MongoClient } from "mongodb";

// Load environment variables FIRST
dotenv.config();

// MongoDB
const url =
  "mongodb+srv://boyerle_db_user:z3SgPsXLuw2S56N0@cluster0.b9hyo30.mongodb.net/?appName=Cluster0";
const dbName = "cs3870db";
const collection = "contacts";
const client = new MongoClient(url);
const db = client.db(dbName);

// Create Express app
const app = express();
// Middleware
app.use(cors());
app.use(express.json()); // replaces body-parser

// Server configuration
const PORT = process.env.PORT ?? 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI;
const DBNAME = process.env.DBNAME;
const COLLECTION = process.env.COLLECTION;

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
    .collection(collection)
    .find(query)
    .limit(100)
    .toArray();
  console.log(results);
  res.status(200);
  // res.send(results);
  res.json(results);
});
//"contacts/<name>" route (Can specify a key to look for, 'name' in this case, and search for only values associated with the key)
app.get("/contacts/:name", async (req, res) => {
  const contactName = decodeURIComponent(req.params.name); // Decode the name parameter
  console.log("Contact to find:", contactName);
  
  await client.connect();
  console.log("Node connected successfully to GET-id MongoDB");
  
  const query = { contact_name: contactName }; // Use the decoded name to query database
  const result = await db.collection(collection).findOne(query);
  
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
      .collection(collection)
      .findOne({ contact_name });
    if (existingContact) {
      return res
        .status(409)
        .json({
          message: `Contact with name '${contact_name}' already exists.`,
        });
    }

    const newDocument = { contact_name, phone_number, message, image_url };
    await db.collection(collection).insertOne(newDocument);
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
        const contactsCollection = db.collection(collection); // Use 'collection' instead of 'COLLECTION'
        
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

// ----Data Fetching functions----

async function fetchData() {
  try {
    // Read the DB :
    const response = await fetch("http://localhost:3000/contacts");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const contacts = await response.json();
    console.log(contacts);
    loadContacts(contacts);
  } catch (err) {
    console.log("error: " + err.message);
  }
}
fetchData();

async function showOneContact() {
  try {
    // Value from the input field
    const name = document.getElementById("contactName").value;
    // Encode the contact name to handle spaces
    const encodedName = encodeURIComponent(name);
    // Fetch the contact by name
    const response = await fetch(`http://localhost:3000/contacts/${encodedName}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const myContact = await response.json();
    loadOneContact(myContact);
  } catch (err) {
    console.log("Error: " + err.message);
  }
}

// ----Data Loading Functions----

// Replace image and text per every one in HTML
function loadContacts(contacts) {
  console.log(contacts);
  let CardContact = document.getElementById("col");
  for (var i = 0; i < contacts.length; i++) {
    let name = contacts[i].contact_name;
    let phone = contacts[i].phone_number;
    let message = contacts[i].message;
    let url = contacts[i].image_url;
    let AddCardContact = document.createElement("div");
    AddCardContact.classList.add("col"); // Add Bootstrap class to the column
    AddCardContact.innerHTML = `
<div class="card shadow-sm">
    <img src=${url} class="card-img-top" alt="..."></img>
        <div class="card-body">
            <p class="card-text"> <strong>${name}</strong>, ${phone} ${message}</p>
        </div>
</div>
`;
    CardContact.appendChild(AddCardContact);
  }
}

function loadOneContact(myContact) {
  console.log(myContact);
  let CardContact = document.getElementById("col2");
  let name = myContact.contact_name;
  let phone = myContact.phone_number;
  let message = myContact.message;
  let url = myContact.image_url;
  let AddCardContact = document.createElement("div");
  AddCardContact.classList.add("col"); // Add Bootstrap class to the column
  AddCardContact.innerHTML = `
<div class="card shadow-sm">
<img src=${url} class="card-img-top" alt="..."></img>
<div class="card-body">
<p class="card-text"> <strong>${name}</strong>, ${phone} ${message}</p>
</div>
</div>
`;
  CardContact.appendChild(AddCardContact);
} // end of function
