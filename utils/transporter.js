import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// Hardcoded credentials for demonstration purposes only.
const EMAIL_USER = "phantasmblaze26@gmail.com";
const CLIENT_ID = "564050155225-ubh2pddqs4ntf7n4q01q7bahkb9vue3a.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04FvJRNzhzQ8nCgYIARAAGAQSNwF-L9IrQ-eWvn0asW9IeVsyG2TCTQnHNntmimCsgX0Py0mc3chOTFo9IP65ug33xIqe_7yatuI";

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: oauth2Client.getAccessToken() 
    }
});

export default transporter;