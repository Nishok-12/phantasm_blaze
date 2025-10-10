import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js";
import axios from "axios";

const router = express.Router();

/* ------------------------------ UTILITIES ------------------------------ */

// ✅ Check if user already registered
const isAlreadyRegistered = async (userId, eventId) => {
  const [result] = await db.query(
    "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
    [userId, eventId]
  );
  return result.length > 0;
};

// ✅ Check single-pass restriction
const hasSinglePassRestriction = async (userId) => {
  const [userPass] = await db.query("SELECT Pass FROM users WHERE id = ?", [userId]);
  if (userPass.length > 0 && userPass[0].Pass === "single") {
    const [regCount] = await db.query(
      "SELECT COUNT(*) AS count FROM registrations WHERE user_id = ?",
      [userId]
    );
    return regCount[0].count > 0;
  }
  return false;
};

/* ------------------------------ ROUTES ------------------------------ */

// 🟢 Get All Events
router.get("/get-events", async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT id, name, DATE_FORMAT(date, '%d-%m-%Y') AS date, 
       TIME_FORMAT(time, '%H:%i:%s') AS time, venue 
       FROM events`
    );
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

// 🟢 Get Slots Taken for Event
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

// 🟢 Prevent browser GET errors for /register
router.get("/register", (req, res) => {
  res.send("🟢 Use POST /api/events/register to register for an event.");
});

/* ------------------------------ REGISTRATION ------------------------------ */

// 🟢 Register for Event
router.post("/register", requireAuth, async (req, res) => {
  const { eventId, teammates = [] } = req.body;
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!eventId) return res.status(400).json({ error: "Event ID is required!" });

  try {
    // Validate event existence
    const [eventExists] = await db.query(
      "SELECT id, name, date, venue FROM events WHERE id = ?",
      [eventId]
    );
    if (eventExists.length === 0)
      return res.status(404).json({ error: "Event not found!" });

    // 1️⃣ Check pass restrictions
    if (await hasSinglePassRestriction(userId)) {
      return res.status(403).json({
        error: "Single Event Pass Holders Can Only Register For One Event.",
      });
    }

    // 2️⃣ Already registered check
    if (await isAlreadyRegistered(userId, eventId)) {
      return res.status(400).json({ error: "User already registered!" });
    }

    // 3️⃣ Event team logic
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

    // 4️⃣ Validate teammates
    const processedTeammates = teammates.map((t) =>
      t === "0" ? 0 : parseInt(String(t).replace(/\D/g, ""))
    );
    const validTeammates = processedTeammates.filter((t) => t !== 0);
    const allTeamMembers = [userId, ...validTeammates];
    const uniqueMembers = new Set(allTeamMembers);

    if (allTeamMembers.length !== uniqueMembers.size)
      return res.status(400).json({ error: "Duplicate teammate IDs found." });

    if (validTeammates.length > maxTeammates)
      return res
        .status(400)
        .json({ error: `Max ${maxTeammates} teammate(s) allowed.` });

    if (!allowSolo && validTeammates.length === 0)
      return res
        .status(400)
        .json({ error: "All teammates are required for this event." });

    // 5️⃣ Validate teammates existence and eligibility
    for (const t of validTeammates) {
      if (await hasSinglePassRestriction(t)) {
        return res.status(403).json({
          error: `Teammate with ID ${t} has a single event pass and is already registered.`,
        });
      }
      if (await isAlreadyRegistered(t, eventId)) {
        return res
          .status(400)
          .json({ error: `Teammate with ID ${t} already registered.` });
      }
      const [existingUser] = await db.query("SELECT id FROM users WHERE id = ?", [t]);
      if (existingUser.length === 0) {
        return res
          .status(400)
          .json({ error: `Teammate with ID ${t} does not exist.` });
      }
    }

    // 6️⃣ Register all members
    const registrationPromises = allTeamMembers.map((memberId) =>
      db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [
        memberId,
        eventId,
      ])
    );
    await Promise.all(registrationPromises);

    const teamMembersString = allTeamMembers.join(",");
    await db.query("INSERT INTO teams (event_id, members) VALUES (?, ?)", [
      eventId,
      teamMembersString,
    ]);

    // 7️⃣ Send email notifications
    const [teamMembersData] = await db.query(
      "SELECT name, email, qr_code_id FROM users WHERE id IN (?)",
      [allTeamMembers]
    );

    for (const member of teamMembersData) {
      try {
        await axios.post("https://phantasm-blaze.onrender.com/api/email/send-email", {
          name: member.name,
          email: member.email,
          qrCodeId: member.qr_code_id,
          event: eventExists[0],
        });
        console.log(`[Email] Sent to ${member.email}`);
      } catch (err) {
        console.warn(`[Email] Failed for ${member.email}: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: "Registration successful!",
      team: teamMembersString,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

export default router;
