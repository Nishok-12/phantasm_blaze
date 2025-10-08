import express from 'express';
import db from "../utils/db.js"; // Assuming db.query/db.execute is your SQL query function
import jwt from 'jsonwebtoken';
import { requireAuth } from "./middleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET; // Use your secret for JWT

router.get("/check-auth", (req, res) => {
    const token = req.cookies.authToken; // Get JWT token from cookies

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Invalid token" });
        }
        res.json({ message: "Authenticated", user: decoded });
    });
});

// This route remains unchanged (does not include pass/transid update), as requested.
router.post("/update-profile", requireAuth, async (req, res) => {
    try {
        // Destructure only the original fields
        const { name, college, year, accommodation, phone } = req.body;
        // Standardized to use userId from the decoded JWT token
        const userId = req.user?.userId; 

        if (!userId) {
            console.error("❌ Error: User ID is undefined!");
            return res.status(401).json({ error: "Unauthorized: User ID is missing." });
        }

        if (!name || !college || !year || !accommodation || !phone) {
            console.error("❌ Error: Missing required core fields!", req.body);
            return res.status(400).json({ error: "Name, College, Year, Accommodation, and Phone are required fields." });
        }

        // Log for debugging
        console.log(`🛠 SQL Query: UPDATE users SET name=?, college=?, year=?, accommodation=?, phone=? WHERE id=?`);
        console.log("📝 Values:", [name, college, year, accommodation, phone, userId]);

        // Execute query
        const [results] = await db.execute(
            "UPDATE users SET name = ?, college = ?, year = ?, accommodation = ?, phone = ? WHERE id = ?",
            [name, college, year, accommodation, phone, userId]
        );

        if (results.affectedRows === 0) {
            console.error("⚠️ No rows updated! Check if user exists.");
            return res.status(400).json({ error: "Profile update failed." });
        }

        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error("❌ Server Error:", err);
        res.status(500).json({ error: "An error occurred while updating the profile." });
    }
});


// Get User Profile Route - Now uses 'pass' and 'transid' from the table with aliases
router.get("/get-profile", async (req, res, next) => {
    console.log("🚀 Route /get-profile has been called");
    next();
}, requireAuth, async (req, res) => {
    try {
        console.log("✅ Passed authentication, now fetching user...");

        if (!req.user || !req.user.userId) {
            console.error("❌ Unauthorized: No user ID found in token");
            return res.status(401).json({ error: "Unauthorized: No user ID found in token" });
        }

        const userId = parseInt(req.user.userId, 10);
        console.log("🔍 Fetching profile for userId:", userId);

        // SQL query updated: using DB columns 'pass' and 'transid' and aliasing them
        // to 'pass_type' and 'transaction_id' for consistency with the frontend.
        const sqlQuery = "SELECT id, name, college, year, accommodation, role, phone, qr_code_id, pass AS pass_type, transid AS transaction_id FROM users WHERE id = ?";
        console.log(`🛠 Running SQL Query: ${sqlQuery} with userId = ${userId}`);

        // Execute query
        const [results] = await db.query(sqlQuery, [userId]);

        if (!results || results.length === 0) {
            console.error("❌ No user found in database for ID:", userId);
            return res.status(404).json({ error: "User not found!" });
        }

        let user = results[0];

        // Generate qr_code_id dynamically if it doesn't exist in the database
        if (!user.qr_code_id) {
            user.qr_code_id = `PSM_${user.id}`;
            await db.query("UPDATE users SET qr_code_id = ? WHERE id = ?", [user.qr_code_id, user.id]);
            console.log(`🔄 Assigned new QR Code ID: ${user.qr_code_id}`);
        }

        console.log("✅ User Found:", user);

        // Send user data as JSON response
        res.json(user);
    } catch (err) {
        console.error("❌ Error in /get-profile:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// Route to get user profile information - Now maps 'pass' and 'transid' to the response keys
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId; // Retrieved from the JWT
        const query = 'SELECT * FROM users WHERE id = ?'; // Query to fetch user data by ID
        const [user] = await db.query(query, [userId]);

        if (!user || user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send user details as a response, using the correct DB column names ('pass' and 'transid')
        // and mapping them to the expected response keys ('pass_type' and 'transaction_id').
        res.json({
            name: user[0].name,
            college: user[0].college,
            year: user[0].year,
            accommodation: user[0].accommodation,
            qr_code_id: user[0].qr_code_id,
            pass_type: user[0].pass, // Using DB column 'pass'
            transaction_id: user[0].transid, // Using DB column 'transid'
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/get-events", async (req, res, next) => {
    console.log("🚀 Route /get-events has been called");
    next();
}, requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId; 
        
        if (!userId) {
            return res.status(400).json({ error: "Invalid or missing userId" });
        }

        // Query to fetch events based on userId
        const [results] = await db.execute(`
            SELECT e.name AS eventName
            FROM events e
            INNER JOIN registrations r ON e.id = r.event_id
            WHERE r.user_id = ?`, [userId]);

        // If no events are found, send an appropriate message
        if (results.length === 0) {
            return res.status(200).json({ message: "No events registered yet." });
        }

        // Return events to the frontend
        res.status(200).json(results);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Database error", details: error.message });
    }
});

router.get("/logout", async (req, res) => {
    console.log("Logout request received!"); // Debugging log
    try {
        res.clearCookie("authToken", { path: "/" });
        return res.status(200).json({ message: "Successfully logged out" });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ error: "Error logging out" });
    }
});

router.get("/payment-status", requireAuth, async (req, res) => {
    try {
        console.log("🔍 Checking authentication...");
        console.log("🔍 req.user:", req.user); // Debugging Log

        const userId = req.user?.userId; // Get user ID from JWT

        if (!userId) {
            console.error("❌ Unauthorized: User ID missing.");
            return res.status(401).json({ error: "Unauthorized: User ID missing." });
        }

        // SQL query to fetch payment status
        console.log(`🛠 Fetching payment status for userId: ${userId}`);
        const sqlQuery = "SELECT payment_status FROM users WHERE id = ?";
        const [results] = await db.query(sqlQuery, [userId]);

        if (!results || results.length === 0) {
            console.error("❌ No user found in database for ID:", userId);
            return res.status(404).json({ error: "User not found!" });
        }

        const paymentStatus = results[0].payment_status || "pending"; // Default to "Pending" if not set
        console.log(`✅ Payment Status for userId ${userId}:`, paymentStatus);

        res.json({ paymentStatus });
    } catch (error) {
        console.error("❌ Error fetching payment status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


export default router;
