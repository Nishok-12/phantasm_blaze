import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// --- CREDENTIALS (Loaded from .env or provided as fallback for testing) ---
// Secure practice: Use environment variables in production.
const EMAIL_USER = process.env.EMAIL_USER || "phantasmblaze26@gmail.com";
const CLIENT_ID = process.env.CLIENT_ID || "564050155225-ubh2pddqs4ntf7n4q01q7bahkb9vue3a.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04FvJRNzhzQ8nCgYIARAAGAQSNwF-L9IrQ-eWvn0asW9IeVsyG2TCTQnHNntmimCsgX0Py0mc3chOTFo9IP65ug33xIqe_7yatuI";

const OAuth2 = google.auth.OAuth2;

// Initialize the OAuth2 client
const oauth2Client = new OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  // Redirect URI used during token generation
  "https://developers.google.com/oauthplayground"
);

// Set the refresh token on the client
oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

// --- NODEMAILER TRANSPORTER SETUP ---
// nodemailer will use the refresh token to automatically fetch a new access token
// when the current one expires.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        // nodemailer handles the accessToken retrieval and refresh automatically 
        // using the provided keys. We don't need to pass a resolved token here.
    }
});

export default transporter;
