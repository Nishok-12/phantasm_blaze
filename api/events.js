import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js";
import nodemailer from "nodemailer";

const router = express.Router();

// ✅ GLOBAL TRANSPORTER (reuse for all emails)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: 'phantasmblaze26@gmail.com',
    pass: 'yxxxesriofsqnmmz', // 🔥 App password (no spaces)
  },
  logger: true,   // optional: enable SMTP logs
  debug: true     // optional: debug SMTP flow
});

// ✅ UTILITY: Check slots taken
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

// ✅ UTILITY: Check if user already registered
const isAlreadyRegistered = async (userId, eventId) => {
  const [result] = await db.query(
    "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
    [userId, eventId]
  );
  return result.length > 0;
};

// ✅ UTILITY: Check single-pass restriction
const hasSinglePassRestriction = async (userId) => {
  const [userPass] = await db.query("SELECT Pass FROM users WHERE id = ?", [userId]);
  if (userPass.length > 0 && userPass[0].Pass === 'single') {
    const [regCount] = await db.query(
      "SELECT COUNT(*) AS count FROM registrations WHERE user_id = ?",
      [userId]
    );
    return regCount[0].count > 0;
  }
  return false;
};

// ✅ SEND REGISTRATION EMAIL
async function sendRegistrationEmail(name, email, qrCodeId, event) {
  const formattedDate = new Date(event.date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const mailOptions = {
    from: "phantasmblaze26@gmail.com",
    to: email,
    subject: `You're Officially Registered! 🎉 – ${event.name}`,
    html: `
      <p>Dear ${name},</p>
      <p>We’re excited to welcome you to <strong>${event.name}</strong> on <strong>${formattedDate}</strong> at <strong>${event.venue}</strong>!</p>
      <h3>✅ Your Registration Details:</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Event Registered:</strong> ${event.name}</p>
      <p><strong>User ID:</strong> ${qrCodeId}</p>
      <p>Stay updated at: <a href="https://phantasm-blaze.onrender.com">Phantasm Blaze</a></p>
      <p><strong>Best Regards,</strong><br/>Phantasm Blaze Team</p>
    `,
  };

   try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL SENT ✅] ${email}: ${info.response}`);
    return true;
  } catch (error) {
    console.error(`[MAIL ERROR ❌] ${email}:`, error);
    return false;
  }
}


// POST route to handle event registration
router.post("/register", requireAuth, async (req, res) => {
    const { eventId, teammates = [] } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!eventId) return res.status(400).json({ error: "Event ID is required!" });

    try {
        const [eventExists] = await db.query(
            "SELECT id, name, date, venue FROM events WHERE id = ?",
            [eventId]
        );
        if (eventExists.length === 0) return res.status(404).json({ error: "Event not found!" });

        // 1. Single Pass Restriction Check (for current user)
        if (await hasSinglePassRestriction(userId)) {
            return res.status(403).json({ error: "Single Event Pass Holders Can Only Register For One Event." });
        }
        // 2. Already Registered Check (for current user)
        if (await isAlreadyRegistered(userId, eventId)) {
            return res.status(400).json({ error: "User already registered for this event!" });
        }
        
        // 3. Team Size/Solo Logic
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

        // 4. Teammate Validation and Processing
        const processedTeammates = teammates.map(t => t === "0" ? 0 : parseInt(String(t).replace(/\D/g, "")));
        const validTeammates = processedTeammates.filter(t => t !== 0);

        const allTeamMembers = [userId, ...validTeammates];
        const uniqueMembers = new Set(allTeamMembers);
        if (allTeamMembers.length !== uniqueMembers.size) {
            return res.status(400).json({ error: "Duplicate user IDs found in team members." });
        }

        if (validTeammates.length > maxTeammates) {
            return res.status(400).json({ error: `This event allows a maximum of ${maxTeammates} teammate(s).` });
        }
        if (!allowSolo && validTeammates.length === 0) {
            return res.status(400).json({ error: "All teammates are required for this event, no solo allowed." });
        }
        if (processedTeammates.some(t => isNaN(t))) 
            return res.status(400).json({ error: "Invalid teammate ID format!" });

        // 5. Teammate Checks (Pass, Registration, Existence)
        for (const t of validTeammates) {
            if (await hasSinglePassRestriction(t)) {
                return res.status(403).json({ error: `Teammate with ID ${t} has a single event pass and is already registered.` });
            }
            if (await isAlreadyRegistered(t, eventId)) {
                return res.status(400).json({ error: `Teammate with ID ${t} is already registered for this event!` });
            }
            const [existingUser] = await db.query("SELECT id FROM users WHERE id = ?", [t]);
            if (existingUser.length === 0) {
                return res.status(400).json({ error: `Teammate with ID ${t} does not exist!` });
            }
        }

        // 6. Database Insertion (Registrations and Teams)
        const allMembers = [userId, ...validTeammates];
        const registrationPromises = allMembers.map(memberId =>
            db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [memberId, eventId])
        );
        await Promise.all(registrationPromises);

        const teamMembersString = allMembers.join(",");
        await db.query("INSERT INTO teams (event_id, members) VALUES (?, ?)", [eventId, teamMembersString]);

        // 7. FINALIZE (Email and Response)
        const [teamMembersData] = await db.query(
            "SELECT name, email, qr_code_id FROM users WHERE id IN (?)",
            [allMembers]
        );

        if (teamMembersData.length === 0) {
            return res.status(404).json({ error: "Team members not found!" });
        }

        // Loop through each team member and send an email
        for (const member of teamMembersData) {
            const sendResult = await sendRegistrationEmail(
                member.name,
                member.email,
                member.qr_code_id,
                eventExists[0]
            );
            if (sendResult === false) {
                console.warn(`[Event Reg] Email to ${member.email} failed: Could not send email.`);
            }
        }

        return res.status(201).json({ message: "Registration successful!", team: teamMembersString });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ error: "Database error!", details: error });
    }
});

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
