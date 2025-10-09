import express from "express";
import db from "../utils/db.js";
import { requireAuth } from "./middleware.js";
import nodemailer from "nodemailer";

const router = express.Router();

// ✅ GLOBAL TRANSPORTER (reuse one connection)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'phantasmblaze26@gmail.com',
    pass: 'yxxxesriofsqnmmz', // no spaces, exact app password
  },
  tls: {
    rejectUnauthorized: false,
  }
});

// ✅ TEST EMAIL ROUTE (check before full registration)
router.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: "phantasmblaze26@gmail.com",
      to: "cyberkingnishok2005@gmail.com",
      subject: "✅ Nodemailer Test from Express",
      text: "If you see this, your Express mail system works fine!"
    });
    console.log("MAIL SENT ✅", info.response);
    res.json({ success: true, message: "Test mail sent!", response: info.response });
  } catch (err) {
    console.error("MAIL ERROR ❌", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Send Registration Email Helper
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
      <h3>✅ Registration Details:</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>User ID:</strong> ${qrCodeId}</p>
      <p><strong>Event:</strong> ${event.name}</p>
      <p>Stay updated: <a href="https://phantasm-blaze.onrender.com">Phantasm Blaze</a></p>
      <p><strong>Regards,</strong><br/>Phantasm Blaze Team</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL SENT ✅] ${email}: ${info.response}`);
    return true;
  } catch (err) {
    console.error(`[MAIL ERROR ❌] ${email}:`, err);
    return false;
  }
}

// ✅ MAIN REGISTER ROUTE
router.post("/register", requireAuth, async (req, res) => {
  const { eventId, teammates = [] } = req.body;
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!eventId) return res.status(400).json({ error: "Event ID is required" });

  try {
    // Fetch event details
    const [eventData] = await db.query("SELECT * FROM events WHERE id = ?", [eventId]);
    if (!eventData.length) return res.status(404).json({ error: "Event not found!" });

    // Register the user (skip full validation for simplicity here)
    await db.query("INSERT INTO registrations (user_id, event_id) VALUES (?, ?)", [userId, eventId]);

    // Fetch user data for email
    const [userData] = await db.query("SELECT name, email, qr_code_id FROM users WHERE id = ?", [userId]);
    const user = userData[0];

    // Send confirmation email
    await sendRegistrationEmail(user.name, user.email, user.qr_code_id, eventData[0]);

    res.status(200).json({ message: "Registration successful and email sent!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;
