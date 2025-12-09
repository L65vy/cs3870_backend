import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Load environment variables FIRST
dotenv.config();

const app = express();
// Middleware
app.use(cors());
app.use(express.json());

// Server configuration
const PORT = process.env.PORT ?? 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI;
const DBNAME = process.env.DBNAME;
const COLLECTION = process.env.COLLECTION;
const client = new MongoClient(MONGO_URI);
const db = client.db(DBNAME);

// ======== SIMPLE ROOT FOR QUICK TESTING ========
app.get("/hello", (req, res) => {
  res.json({ message: "Hello from NodeJS/Express" });
});

// ======== CONFIG FOR JWT ========
const SECRET_KEY = "SUPER_SECRET_KEY_CHANGE_ME"; // use env var in real apps
const ACCESS_TOKEN_EXPIRE_MINUTES = 30; // set 1 for demos if you want

// ======== SIMPLE USER "DB" (in-memory for demo) ========
// key: email, value: hashed password
const fakeUsersDb = {};
// Helper: save user
function saveUserToDb(email, hashedPw) {
  fakeUsersDb[email] = hashedPw;
  console.log("DB state:", fakeUsersDb); // debugging
}
// Helper: get user
function getUserByEmail(email) {
  const hashedPw = fakeUsersDb[email];
  if (!hashedPw) return null;
  return { email, hashedPassword: hashedPw };
}

// ======== 1) SIGNUP ========
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    // Basic validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ detail: "email and password are required" });
    }
    // Check if user exists
    if (fakeUsersDb[email]) {
      console.log(`User ${email} already exists`);
      return res.status(400).json({ detail: "User already exists" });
    }
    console.log("New user:", email, password); // debugging (don't do this in prod)
    // Hash password with bcrypt
    const hashedPw = await bcrypt.hash(password, 10); // 10 = salt rounds
    saveUserToDb(email, hashedPw);
    return res.json({ msg: "signup ok" });
  } catch (err) {
    console.error("Error in /signup:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
});

// ======== 2) LOGIN ========
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ detail: "email and password are required" });
    }
    const dbUser = getUserByEmail(email);
    if (!dbUser) {
      return res.status(401).json({ detail: "Invalid credentials-User" });
    }
    const validPassword = await bcrypt.compare(password, dbUser.hashedPassword);
    if (!validPassword) {
      return res.status(401).json({ detail: "Invalid credentials-Password" });
    }
    // sub = subject (usually the user id or email)
    const token = jwt.sign(
      { sub: dbUser.email },
      SECRET_KEY,
      { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` } // e.g. "30m"
    );
    console.log("Token:", token);
    console.log("DB:", fakeUsersDb);
    return res.json({ token }); // shape { "token": "<JWT>" }
  } catch (err) {
    console.error("Error in /login:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
});

// ======== 3) JWT AUTH MIDDLEWARE (like get_current_user) ========
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ detail: "Missing Authorization header" });
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ detail: "Invalid Authorization header" });
  }
  jwt.verify(token, SECRET_KEY, (err, payload) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ detail: "Token expired" });
      }
      return res.status(401).json({ detail: "Invalid token" });
    }
    const email = payload.sub;
    if (!email) {
      return res.status(401).json({ detail: "Invalid token payload" });
    }
    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }
    // Attach to request so protected route can use it
    req.userEmail = email;
    next();
  });
}

// ======== 4) PROTECTED ROUTE ========
app.get("/protected", authenticateToken, (req, res) => {
  return res.json({ msg: `Hello ${req.userEmail}, this is protected data!` });
});

// ======== 5) GET ALL ========
app.get("/contacts", async (req, res) => {
  try {
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
    res.json(results);
  } catch (error) {
    console.error("Error in GET /contacts:", error);
    res.status(500);
    res.json({ message: "Failed to retrieve contacts" + error.message });
  }
});

// ======== 6a) GET ONE BY NAME ========
app.get("/contacts/:contact_name", async (req, res) => {
  try {
    const contactName = req.params.contact_name;
    if (!contactName) {
      return res.status(400).json({ message: "Contact name is required" });
    }

    await client.connect();
    console.log("Node connected successfully to GET one MongoDB");
    const contact = await db
      .collection(COLLECTION)
      .findOne({ contact_name: contactName });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200);
    res.json(contact);
  } catch (error) {
    console.error("Error in GET /contacts/:contact_name:", error);
    res.status(500);
    res.json({ message: "Failed to retrieve contact: " + error.message });
  }
});

// ======== 6) POST Add new contact ========
// Now this route is protected by JWT
app.post("/contacts", authenticateToken, async (req, res) => {
  try {
    // Optional: see which user is adding the contact
    console.log("User adding contact:", req.userEmail);
    // The body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res
        .status(400)
        .send({ message: "Bad request: No data provided." });
    }
    // Extract fields from body
    const { contact_name, phone_number, message, image_url } = req.body;
    // Connect to MongoDB
    await client.connect();
    console.log("Node connected successfully to POST MongoDB");
    // Reference collection
    const contactsCollection = db.collection(COLLECTION);
    // Check if contact already exists
    const existingContact = await contactsCollection.findOne({
      contact_name: contact_name,
    });
    if (existingContact) {
      return res.status(409).json({
        message: `Contact with name ${contact_name} already exists.`,
      });
    }
    // Create new Document to POST
    const newDocument = {
      contact_name,
      phone_number,
      message,
      image_url,
    };
    console.log(newDocument);
    // Insert new document into MongoDB
    const result = await contactsCollection.insertOne(newDocument);
    console.log("Document inserted:", result);
    // Acknowledge frontend
    res.status(201);
    res.json({ message: "Response: New contact added successfully" });
  } catch (error) {
    console.error("Error in POST /contacts:", error);
    res.status(500);
    res.json({ message: "Failed to add contact: " + error.message });
  } finally {
    await client.close();
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
