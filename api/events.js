import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js"; // Correct import of requireAuth
const router = express.Router();
import nodemailer from "nodemailer";

// Add this new route below the existing ones in events.js
router.get("/slots-taken/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;
        const [result] = await db.query(
            "SELECT COUNT(*) AS slotsTaken FROM teams WHERE event_id = ?",
            [eventId]
        );
        res.json({ slotsTaken: result[0].slotsTaken });
    } catch (error) {
        console.error("Error fetching slots:", error);
        res.status(500).json({ error: "Failed to fetch slots data." });
    }
});

// Function to check if a user is already registered for a specific event
const isAlreadyRegistered = async (userId, eventId) => {
    const [result] = await db.query(
        "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
        [userId, eventId]
    );
    return result.length > 0;
};

// Function to check if a user has a single pass and is already registered for an event
const hasSinglePassRestriction = async (userId) => {
    // 1. Check user's Pass type
    const [userPass] = await db.query("SELECT Pass FROM users WHERE id = ?", [userId]);
    
    // If user is found and has a 'single' pass
    if (userPass.length > 0 && userPass[0].Pass === 'single') {
        // 2. Count existing registrations
        const [regCount] = await db.query(
            "SELECT COUNT(*) AS count FROM registrations WHERE user_id = ?",
            [userId]
        );
        // Return true if they have any existing registrations
        return regCount[0].count > 0;
    }
    return false;
};


router.post("/register", requireAuth, async (req, res) => {
    const { eventId, teammates = [] } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!eventId) return res.status(400).json({ error: "Event ID is required!" });

    try {
        // 1. Check if event exists
        const [eventExists] = await db.query(
            "SELECT id, name, date, venue FROM events WHERE id = ?",
            [eventId]
        );
        if (eventExists.length === 0) return res.status(404).json({ error: "Event not found!" });

        // 2. CHECK MAIN USER RESTRICTIONS (Single Pass & Duplicate Registration)
        
        // Single Pass Restriction Check (Any prior registration blocks registration)
        if (await hasSinglePassRestriction(userId)) {
            return res.status(403).json({ error: "Single Event Pass Holders Can Only Register For One Event." });
        }

        // Duplicate Registration Check (Already registered for THIS specific event)
        if (await isAlreadyRegistered(userId, eventId)) {
            return res.status(400).json({ error: "User already registered for this event!" });
        }
        
        // 3. DETERMINE RULES
        let maxTeammates = 0;
        let allowSolo = true;

        if (eventId === 1) {
            maxTeammates = 1;
            allowSolo = true;
        } else if ([6, 7, 8, 9].includes(Number(eventId))) {
            maxTeammates = 3;
            allowSolo = false;
        } else if ([2, 3, 4, 5].includes(Number(eventId))) {
            maxTeammates = 0;
            allowSolo = true;
        }

        // 4. VALIDATE TEAMMATE INPUTS
        const processedTeammates = teammates.map(t => t === "0" ? 0 : parseInt(String(t).replace(/\D/g, "")));
        const validTeammates = processedTeammates.filter(t => t !== 0);

        // **NEW: Check for duplicate IDs within the team**
        const allTeamMembers = [userId, ...validTeammates];
        const uniqueMembers = new Set(allTeamMembers);
        if (allTeamMembers.length !== uniqueMembers.size) {
            return res.status(400).json({ error: "Duplicate user IDs found in team members." });
        }

        // Validate team size
        if (validTeammates.length > maxTeammates) {
             return res.status(400).json({ error: `This event allows a maximum of ${maxTeammates} teammate(s).` });
        }
        if (!allowSolo && validTeammates.length === 0) {
            return res.status(400).json({ error: "All teammates are required for this event, no solo allowed." });
        }
        if (processedTeammates.some(t => isNaN(t))) 
            return res.status(400).json({ error: "Invalid teammate ID format!" });

        // 5. CHECK TEAMMATE RESTRICTIONS (Single Pass & Duplicate Registration)
        
        // We validate existence here to ensure we only check real users
        for (const t of validTeammates) {
            
            // Check for single pass restriction for each teammate
            if (await hasSinglePassRestriction(t)) {
                return res.status(403).json({ error: `Teammate with ID ${t} has a single event pass and is already registered.` });
            }

            // Check if teammate is already registered for this specific event
            if (await isAlreadyRegistered(t, eventId)) {
                return res.status(400).json({ error: `Teammate with ID ${t} is already registered for this event!` });
            }
            
            // Final check: Does the teammate ID exist in the users table?
            const [existingUser] = await db.query("SELECT id FROM users WHERE id = ?", [t]);
            if (existingUser.length === 0) {
                return res.status(400).json({ error: `Teammate with ID ${t} does not exist!` });
            }

            validTeammates.push(t);
        }

        // 6. INSERT DATA
        
        // Insert current user
        await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [userId, eventId]);

        // Insert teammates
        for (const t of validTeammates) {
            await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [t, eventId]);
        }

        // Insert into teams table
        const allMembers = [userId, ...validTeammates].join("+");
        if (validTeammates.length > 0) {
            await db.query("INSERT INTO teams (event_id, members) VALUES (?, ?)", [eventId, allMembers]);
        }

        // 7. FINALIZE (Email and Response)
        
        // Fetch user for email
        const [user] = await db.query("SELECT name, email, qr_code_id FROM users WHERE id = ?", [userId]);
        if (user.length === 0) return res.status(404).json({ error: "User not found!" });

        await sendRegistrationEmail(user[0].name, user[0].email, user[0].qr_code_id, eventExists[0]);

        return res.status(201).json({ message: "Registration successful!", team: allMembers });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ error: "Database error!", details: error });
    }
});

async function sendRegistrationEmail(name, email, qrCodeId, event) {
    const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
const formattedDate = new Date(event.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
});

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `You're Officially Registered! 🎉 – ${event.name}`,
        html: `
            <p>Dear ${name},</p>
            <p>We’re excited to welcome you to <strong>${event.name}</strong> on <strong>${formattedDate}</strong> at <strong>${event.venue}</strong>! Your registration has been confirmed, and we can’t wait to see you there.</p>
            <h3>✅ Your Registration Details:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Event Registered:</strong> ${event.name}</p>
            <p><strong>user ID:</strong> ${qrCodeId}</p>
https://phantasm-blaze.onrender.com
            <p>Got questions? Feel free to reach out at phantasmblaze26@gmail.com. Stay updated by visiting https://phantasm-blaze.onrender.com</p>
            <p>See you soon!</p>
            <p><strong>Best Regards,</strong></p>
            <p>Phantasm Blaze Team</p>
        `,
    };

    await transporter.sendMail(mailOptions);
}

// 🟢 Get All Events (Public Route)
router.get("/get-events", async (req, res) => {
    try {
        const [events] = await db.query(
            `SELECT id, name, DATE_FORMAT(date, '%d-%m-%Y') AS date, 
            TIME_FORMAT(time, '%H:%i:%s') AS time FROM events`
        );

        res.json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events." });
    }
});



export default router;
