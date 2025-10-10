// Import required modules
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { requireAuth } from "./middleware.js";
import db from "../utils/db.js";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const router = express.Router();

/* -------------------- PASSWORD RESET ROUTES -------------------- */


// ============================
// 🔹 FORGOT PASSWORD
// ============================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // 1️⃣ Get user by email
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.json({ success: false, message: "No user found with this email." });
    }

    const user = rows[0];
    const phone = user.phone;

    if (!phone) {
      return res.json({ success: false, message: "Phone number not found for this account." });
    }

    // 2️⃣ Generate random 5-character string
    const randomString = crypto.randomBytes(3).toString("hex").slice(0, 5);

    // 3️⃣ Create reset token = phone + randomString
    const resetToken = `${phone}${randomString}`;

    // 4️⃣ Expiration: 1 hour
    const resetExpires = Date.now() + 60 * 60 * 1000;

    // 5️⃣ Update DB with token + expiry
    await db.query(
      "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?",
      [resetToken, resetExpires, email]
    );

    console.log(`[Forgot Password] Token generated for ${email}: ${resetToken}`);

    // 6️⃣ Respond with only random string & example
    res.json({
      success: true,
      message: "Reset token generated successfully!",
      note: "Your reset token = your registered phone number + the following string.",
      randomString,
      example: `If your phone number is ${phone} and the string is '${randomString}', enter reset token as: ${phone}${randomString}`,
      expiresIn: "1 hour",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error, please try again later." });
  }
});

// ============================
// 🔹 RESET PASSWORD
// ============================
router.post("/reset-password", async (req, res) => {
  const { email, resetToken, newPassword } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? AND reset_token = ?",
      [email, resetToken]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "Invalid token or email." });
    }

    const user = rows[0];

    // ⏰ Check expiry
    if (Date.now() > user.reset_expires) {
      return res.json({
        success: false,
        message: "Token expired. Please request a new one.",
      });
    }

    // 🔒 Hash password
    const bcrypt = await import("bcrypt");
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ Update password and clear reset info
    await db.query(
      "UPDATE users SET pass = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?",
      [hashedPassword, email]
    );

    res.json({ success: true, message: "Password reset successful!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error, please try again later." });
  }
});


/* -------------------- ADMIN VALIDATION -------------------- */

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }
  next();
};

const queryDatabase = async (query, values) => {
  try {
    const [results] = await db.query(query, values);
    return results;
  } catch (error) {
    throw error;
  }
};

/* -------------------- USER REGISTRATION -------------------- */

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      college,
      department,
      reg_no,
      year,
      phone,
      email,
      password,
      accommodation,
      role,
      admin_key,
      transid,
      Pass,
    } = req.body;

    if (
      !name ||
      !college ||
      !department ||
      !reg_no ||
      !year ||
      !phone ||
      !email ||
      !password ||
      !accommodation ||
      !role ||
      !transid ||
      !Pass
    ) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res
        .status(400)
        .json({ error: "Invalid phone number! Must be 10 digits." });
    }

    if (role === "admin" && admin_key !== process.env.ADMIN_KEY) {
      return res.status(400).json({ error: "Invalid admin key!" });
    }

    const transactionIdRegex = /^\d{12}$/;
    if (!transactionIdRegex.test(transid)) {
      return res.status(400).json({ error: "Invalid transaction ID!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [existingUser] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ error: "User with this email already exists." });
    }

    const result = await db.query(
      `INSERT INTO users (name, college, department, reg_no, year, phone, email, password, accommodation, role, transid, Pass) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        college,
        department,
        reg_no,
        year,
        phone,
        email,
        hashedPassword,
        accommodation,
        role,
        transid,
        Pass,
      ]
    );

    const userId = result.insertId;
    const qrCodeId = `PSM_${userId}`;

    await db.query(`UPDATE users SET qr_code_id = ? WHERE id = ?`, [
      qrCodeId,
      userId,
    ]);

    const token = jwt.sign({ email, role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Poster check (optional)
    const posterPath = path.resolve("public", "poster.pdf");
    if (!fs.existsSync(posterPath)) {
      console.warn("Poster file not found:", posterPath);
    }

    // ⚠️ Email sending removed — replaced with console logs
    console.log(
      `[Registration] User ${name} (${email}) registered successfully. QR: ${qrCodeId}`
    );

    res.status(201).json({
      message: `${
        role === "user" ? "User" : "Admin"
      } registered successfully!`,
      token,
      qr_code_id: qrCodeId,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Server error!" });
  }
});

export default router;
