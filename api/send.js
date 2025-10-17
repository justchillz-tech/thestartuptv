// /api/send.js

const GSCRIPT_WEBHOOK = process.env.GSCRIPT_WEBHOOK; // Your Google Apps Script Web App URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Send data to Google Apps Script
    const gscriptRes = await fetch(GSCRIPT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });

    if (!gscriptRes.ok) {
      console.error(await gscriptRes.text());
      throw new Error("Failed to send data to Google Apps Script");
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
