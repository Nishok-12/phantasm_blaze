import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js"; // Correct import of requireAuth
const router = express.Router();
import nodemailer from "nodemailer";
router.post("/register", requireAuth, async (req, res) => {
    const { eventId, teammates = [] } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!eventId) return res.status(400).json({ error: "Event ID is required!" });

    try {
        // Check if event exists
        const [eventExists] = await db.query(
            "SELECT id, name, date, venue FROM events WHERE id = ?",
            [eventId]
        );
        if (eventExists.length === 0) return res.status(404).json({ error: "Event not found!" });

        // Determine rules
        let maxTeammates = 0;
        let allowSolo = true;

        if (eventId === 1) {
            maxTeammates = 1;
            allowSolo = true;
        } else if ([6,7,8,9].includes(Number(eventId))) {
            maxTeammates = 3;
            allowSolo = false;
        } else if ([2,3,4,5].includes(Number(eventId))) {
            maxTeammates = 0;
            allowSolo = true;
        }

        // Validate teammate count
        

        // Convert teammate IDs: "PBZ_1" -> 1, "0" stays as 0
        const processedTeammates = teammates.map(t => t === "0" ? 0 : parseInt(String(t).replace(/\D/g, "")));

        // For non-solo events, no 0 allowed
        if (!allowSolo && processedTeammates.some(t => t === 0)) {
            return res.status(400).json({ error: "All teammates are required for this event, no solo allowed." });
        }

        // Validate numeric IDs
        if (processedTeammates.some(t => isNaN(t))) 
            return res.status(400).json({ error: "Invalid teammate ID format!" });

        // Validate teammates exist (skip 0)
        const validTeammates = processedTeammates.filter(t => t !== 0);
        if (validTeammates.length > 0) {
            const [existingTeammates] = await db.query(
                `SELECT id FROM users WHERE id IN (${validTeammates.map(() => "?").join(",")})`,
                validTeammates
            );
            if (existingTeammates.length !== validTeammates.length) 
                return res.status(400).json({ error: "One or more teammate IDs are invalid!" });
        }

        // Check if current user already registered
        const [alreadyRegistered] = await db.query(
            "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
            [userId, eventId]
        );
        if (alreadyRegistered.length > 0) 
            return res.status(400).json({ error: "User already registered for this event!" });

        // Insert current user
        await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [userId, eventId]);

        // Insert teammates (non-zero only)
        for (const t of validTeammates) {
            await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [t, eventId]);
        }

        // Insert into teams table (only if teammates exist)
        const allMembers = [userId, ...validTeammates].join(",");
        if (validTeammates.length > 0) {
            await db.query("INSERT INTO teams (event_id, members) VALUES (?, ?)", [eventId, allMembers]);
        }

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
            <p>Got questions? Feel free to reach out at phantasm25cse@gmail.com. Stay updated by visiting https://phantasm.onrender.com</p>
            <p>See you soon!</p>
            <p><strong>Best Regards,</strong></p>
            <p>Phantasm'25 Team</p>
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
