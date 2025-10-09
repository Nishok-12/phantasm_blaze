import express from "express";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import adminRoutes from "./admin.js";
import authRoutes from "./auth.js";
import eventsRoutes from "./events.js";
import loginRoutes from "./login.js";
import db from "../utils/db.js";
import userRouter from './user.js';
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { requireAuth } from "../middleware.js";

// Load environment variables from .env file immediately
dotenv.config(); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cookieParser()); // Parse cookies before handling requests

// Enable CORS globally (Adjust origin if needed)
app.use(cors({
    origin: 'https://phantasm-blaze.onrender.com',  // Replace with your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:true
}));

// Use express.json() to parse JSON request bodies
app.use(express.json()); 

// Optional: Use bodyParser.urlencoded({ extended: true }) for form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files
const __dirname = path.resolve();

// IMPORTANT: Disable the default index file serving for static middleware.
// This prevents it from automatically serving 'index.html' when it sees '/'.
app.use(express.static(path.join(__dirname, "public"), { index: false })); 

// Define routes
// Example usage for admin routes
app.use("/api/admin", requireAuth, adminRoutes);
app.use('/api/auth', authRoutes);
app.use("/api/events", requireAuth, eventsRoutes);
app.use("/api/login", loginRoutes);  
// Authentication is handled on individual user routes (e.g., in user.js)
app.use("/api/user", userRouter);

// Test database route
app.get("/test-db", async (req, res) => {
    // WARNING: Using a hardcoded ID (1) is only for testing purposes.
    const userId = 1;

    let connection; // Declare connection outside try block for scope

    try {
        console.log("[DB] Starting Database Query for userId:", userId);

        // Ensure db is available and connected
        connection = await db.getConnection();
        console.log("[DB] Connection acquired from pool");

        // Running the query
        const [results] = await connection.execute(
            "SELECT id, name, college, year, accommodation, role FROM users WHERE id = ?",
            [userId]
        );

        console.log("[DB] Query Results:", results);
        
        if (!results || results.length === 0) {
            console.error("[DB] No user found for ID:", userId);
            return res.status(404).json({ error: "User not found!" });
        }

        res.json(results[0]);

    } catch (err) {
        console.error("[DB] Database query error:", err);
        res.status(500).json({ error: "Database error!" });
   } finally {
        if (connection) {
            connection.release();  // Always release the connection in the finally block
        }
    }
});

console.log("[DEBUG] Checking Database Connection State:", db);


// This explicit route will now be served for the root, ensuring 'blaze_pre.html' opens first.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "blaze_pre.html"));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
