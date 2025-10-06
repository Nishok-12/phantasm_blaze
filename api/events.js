import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js"; // Correct import of requireAuth
const router = express.Router();
import nodemailer from "nodemailer";
router.post("/register", requireAuth, async (req, res) => {
  console.log("User data in request:", req.user);
  const { eventId, teammates = [] } = req.body; // teammates from frontend
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!eventId) {
    return res.status(400).json({ error: "Event ID is required!" });
  }

  try {
    // 🔍 Check if event exists
    const [eventExists] = await db.query(
      "SELECT id, name, date, venue FROM events WHERE id = ?",
      [eventId]
    );

    if (eventExists.length === 0) {
      return res.status(404).json({ error: "Event not found!" });
    }

    // 🧩 Define allowed team size
    const teamSize =
      eventId == 1
        ? 2 // user + 1 teammate
        : [6, 7, 8, 9].includes(Number(eventId))
        ? 4 // user + 3 teammates
        : 1; // solo

    // ⚠️ Validate teammate count
    if (teammates.length !== teamSize - 1) {
      return res.status(400).json({
        error: `This event requires ${teamSize} participants in total (${teamSize - 1} teammates).`,
      });
    }

    // 🧮 Convert "PBZ_1" → 1
    const currentUserIdNum = parseInt(String(userId).replace(/\D/g, ""));
    const teammateIds = teammates.map((t) => parseInt(String(t).replace(/\D/g, "")));

    // 🧩 Check if user already registered
    const [alreadyRegistered] = await db.query(
      "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
      [currentUserIdNum, eventId]
    );

    if (alreadyRegistered.length > 0) {
      return res
        .status(400)
        .json({ error: "User already registered for this event!" });
    }

    // ✅ Register all users in registrations table
    await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [
      currentUserIdNum,
      eventId,
    ]);

    for (const teammateId of teammateIds) {
      await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [
        teammateId,
        eventId,
      ]);
    }

    // 🧾 Insert into teams table
    const allMembers = [currentUserIdNum, ...teammateIds].join("+");
    await db.query("INSERT INTO teams (event_id, members) VALUES (?, ?)", [
      eventId,
      allMembers,
    ]);

    // 🎫 Fetch user details for email
    const [user] = await db.query(
      "SELECT name, email, qr_code_id FROM users WHERE id = ?",
      [currentUserIdNum]
    );

    if (user.length === 0) {
      console.error("Error: User not found in database.");
      return res.status(404).json({ error: "User not found!" });
    }

    // ✉️ Send confirmation mail
    await sendRegistrationEmail(
      user[0].name,
      user[0].email,
      user[0].qr_code_id,
      eventExists[0]
    );

    return res.status(201).json({
      message: "Team registration successful!",
      team: allMembers,
    });
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
