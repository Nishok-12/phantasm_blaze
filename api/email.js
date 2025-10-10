// api/email.js
const nodemailer = require("nodemailer");
const express = require("express");

const router = express.Router();

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "phantasmblaze26@gmail.com",
    pass: "yxxxesriofsqnmmz", // Gmail App Password
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Email sending route
router.post("/send-email", async (req, res) => {
  try {
    const { name, email, qrCodeId, event } = req.body;

    if (!name || !email || !qrCodeId || !event?.name || !event?.date || !event?.venue) {
      return res.status(400).json({ error: "Missing required email data." });
    }

    const formattedDate = new Date(event.date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const mailOptions = {
      from: "phantasmblaze26@gmail.com",
      to: email,
      subject: `You're Registered! 🎉 – ${event.name}`,
      html: `
        <p>Dear ${name},</p>
        <p>Your registration for <strong>${event.name}</strong> on <strong>${formattedDate}</strong> at <strong>${event.venue}</strong> is confirmed.</p>
        <p><strong>User ID:</strong> ${qrCodeId}</p>
        <p><strong>Event:</strong> ${event.name}</p>
        <p>Stay updated: <a href="https://phantasm-blaze.onrender.com">Phantasm Blaze</a></p>
        <p><strong>Regards,</strong><br/>Phantasm Blaze Team</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL SENT ✅] ${email}: ${info.response}`);
    res.status(200).json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("[MAIL ERROR ❌]", error);
    res.status(500).json({ success: false, error: "Failed to send email." });
  }
});

export default router;
