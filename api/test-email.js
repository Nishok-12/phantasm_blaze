// ✅ TEST EMAIL ROUTE
router.get("/test-email", async (req, res) => {
  try {
    const testMailOptions = {
      from: "phantasmblaze26@gmail.com",
      to: "cyberkingnishok2005@gmail.com", // change to your test email
      subject: "Phantasm Blaze – Test Email ✅",
      text: "This is a test email from your Express + Nodemailer setup!",
    };

    const info = await transporter.sendMail(testMailOptions);
    console.log("[MAIL SENT ✅]", info.response);
    res.json({ message: "Test email sent successfully!", info: info.response });
  } catch (error) {
    console.error("[MAIL ERROR ❌]", error);
    res.status(500).json({ error: "Failed to send test email", details: error.message });
  }
});
