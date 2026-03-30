const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// 🔐 Secret ONLY for approval token (not XSUAA)
const APPROVAL_SECRET = process.env.APPROVAL_SECRET || "approval-secret";

// In-memory store (replace with DB later)
const processedQuotes = new Set();

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.send("Quote Approval Backend running");
});

/**
 * Create approval request
 * Called via approuter (/api/approval-request)
 * NO authentication here
 */
app.post("/api/approval-request", (req, res) => {
  const { quoteId, approverEmail } = req.body;

  if (!quoteId || !approverEmail) {
    return res.status(400).json({ error: "Missing quoteId or approverEmail" });
  }

  // 🔐 Create short-lived approval token
  const token = jwt.sign(
    { quoteId, approverEmail },
    APPROVAL_SECRET,
    { expiresIn: "1h" }
  );

  // 🌍 Build FULL approuter URL dynamically
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");

  const approvalUrl = `${protocol}://${host}/decision?token=${token}`;

  res.json({
    quoteId,
    approvalUrl
  });
});

/**
 * Decision page
 * Auth handled ONLY by approuter (xsuaa)
 */
app.get("/decision", (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send("Missing token");
  }

  try {
    const decoded = jwt.verify(token, APPROVAL_SECRET);

    if (processedQuotes.has(decoded.quoteId)) {
      return res.send("This quote has already been processed.");
    }

    res.send(`
      <html>
        <head>
          <title>Service Quote Approval</title>
        </head>
        <body>
          <h2>Service Quote Approval</h2>

          <p><b>Quote ID:</b> ${decoded.quoteId}</p>
          <p><b>Approver:</b> ${decoded.approverEmail}</p>

          <form method="POST" action="/submitDecision">
            <input type="hidden" name="token" value="${token}" />

            <label>Comment:</label><br/>
            <textarea name="comment" required rows="4" cols="50"></textarea><br/><br/>

            <button type="submit" name="decision" value="APPROVE">Approve</button>
            <button type="submit" name="decision" value="REJECT">Reject</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send("Invalid or expired token");
  }
});

/**
 * Submit approval decision
 */
app.post("/submitDecision", (req, res) => {
  const { token, decision, comment } = req.body;

  if (!token || !decision || !comment) {
    return res.status(400).send("Missing data");
  }

  try {
    const decoded = jwt.verify(token, APPROVAL_SECRET);

    if (processedQuotes.has(decoded.quoteId)) {
      return res.send("This quote has already been processed.");
    }

    // Mark as processed
    processedQuotes.add(decoded.quoteId);

    // 🔁 Here you would call S/4 / workflow / DB
    console.log("Decision received:", {
      quoteId: decoded.quoteId,
      approver: decoded.approverEmail,
      decision,
      comment
    });

    res.send(`
      <html>
        <body>
          <h3>Thank you</h3>
          <p><b>${decision}</b> recorded for quote <b>${decoded.quoteId}</b>.</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send("Invalid or expired token");
  }
});

app.listen(PORT, () => {
  console.log("Quote Approval Backend running on port", PORT);
});
