const express = require("express");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

// More robust email validation regex
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "..");
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join("/tmp", "valiant-garage-doors") : path.join(__dirname, "data");
const REQUESTS_FILE = path.join(DATA_DIR, "requests.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS) || 5000;
const MAX_REVIEWS = Number(process.env.MAX_REVIEWS) || 1000;
const KV_PREFIX = process.env.KV_PREFIX || "prod";
const REQUESTS_KEY = `${KV_PREFIX}:requests`;
const REVIEWS_KEY = `${KV_PREFIX}:reviews`;
const EMAIL_TO = process.env.REQUESTS_TO || "vm@valiantdoor.com";
const EMAIL_FROM = process.env.REQUESTS_FROM || EMAIL_TO;

// Initialize Vercel KV if available
let kv = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  try {
    kv = require("@vercel/kv").kv;
    console.log("Vercel KV initialized");
  } catch (error) {
    console.warn("Vercel KV not available:", error.message);
  }
}

// Helper: HTML escape
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Helper: Data storage abstraction
async function readData(key, file) {
  if (kv) {
    try {
      const data = await kv.get(key);
      return data || [];
    } catch (error) {
      console.error(`Error reading from KV ${key}:`, error);
      return [];
    }
  } else {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const content = await fs.readFile(file, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      console.error(`Error reading ${file}:`, error);
      return [];
    }
  }
}

async function writeData(key, file, data, maxSize) {
  const trimmed = data.slice(-maxSize);
  if (kv) {
    try {
      await kv.set(key, trimmed);
    } catch (error) {
      console.error(`Error writing to KV ${key}:`, error);
    }
  } else {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(trimmed, null, 2));
    } catch (error) {
      console.error(`Error writing ${file}:`, error);
    }
  }
}

// Email transporter
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log("Email transporter configured");
} else {
  console.warn("Email not configured - emails will be skipped");
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: "Too many requests, please try again later." }
});

const testEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: "Too many test email requests." }
});

app.use("/api/", apiLimiter);

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    storage: kv ? "Vercel KV" : "File system",
    email: transporter ? "configured" : "not configured"
  });
});

// API: Submit quote request
app.post("/api/requests", async (req, res) => {
  try {
    const { name, email, phone, address, service, message, honeypot } = req.body;

    // Honeypot check - silently reject spam
    if (honeypot) {
      // Return success to avoid detection, but don't log
      return res.json({ success: true, message: "Request submitted successfully!" });
    }

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required fields."
      });
    }

    // Validate email format
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address."
      });
    }

    // Create request object
    const request = {
      id: crypto.randomUUID(),
      name: escapeHtml(name),
      email: escapeHtml(email),
      phone: escapeHtml(phone),
      address: escapeHtml(address || ""),
      service: escapeHtml(service || ""),
      message: escapeHtml(message || ""),
      timestamp: new Date().toISOString(),
      emailStatus: "pending"
    };

    // Save to storage
    const requests = await readData(REQUESTS_KEY, REQUESTS_FILE);
    requests.push(request);
    await writeData(REQUESTS_KEY, REQUESTS_FILE, requests, MAX_REQUESTS);

    // Send email if configured
    let emailStatus = "skipped";
    if (transporter) {
      try {
        const mailOptions = {
          from: EMAIL_FROM,
          to: EMAIL_TO,
          subject: `New Quote Request from ${request.name}`,
          html: `
            <h2>New Quote Request</h2>
            <p><strong>Name:</strong> ${request.name}</p>
            <p><strong>Email:</strong> ${request.email}</p>
            <p><strong>Phone:</strong> ${request.phone}</p>
            <p><strong>Address:</strong> ${request.address || "Not provided"}</p>
            <p><strong>Service:</strong> ${request.service || "Not specified"}</p>
            <p><strong>Message:</strong></p>
            <p>${request.message || "No additional message"}</p>
            <p><strong>Submitted:</strong> ${new Date(request.timestamp).toLocaleString()}</p>
          `
        };

        await transporter.sendMail(mailOptions);
        emailStatus = "sent";
        console.log(`Email sent for request ${request.id}`);
      } catch (error) {
        emailStatus = "failed";
        console.error("Error sending email:", error);
      }
    }

    // Update email status
    request.emailStatus = emailStatus;
    const updatedRequests = await readData(REQUESTS_KEY, REQUESTS_FILE);
    const index = updatedRequests.findIndex((r) => r.id === request.id);
    if (index !== -1) {
      updatedRequests[index] = request;
      await writeData(REQUESTS_KEY, REQUESTS_FILE, updatedRequests, MAX_REQUESTS);
    }

    console.log(`Quote request ${request.id} from ${name} (${email})`);

    res.json({
      success: true,
      message: "Quote request submitted successfully! We will contact you soon."
    });
  } catch (error) {
    console.error("Error processing quote request:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while submitting your request. Please try again later."
    });
  }
});

// API: Get all requests (admin)
app.get("/api/requests", async (req, res) => {
  try {
    const requests = await readData(REQUESTS_KEY, REQUESTS_FILE);
    res.json({ success: true, requests, count: requests.length });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ success: false, message: "Error fetching requests" });
  }
});

// API: Get reviews
app.get("/api/reviews", async (req, res) => {
  try {
    const allReviews = await readData(REVIEWS_KEY, REVIEWS_FILE);
    const approvedReviews = allReviews.filter((r) => r.status === "approved");
    res.json({ success: true, reviews: approvedReviews, count: approvedReviews.length });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ success: false, message: "Error fetching reviews" });
  }
});

// API: Submit review
app.post("/api/reviews", async (req, res) => {
  try {
    const { name, city, rating, message, honeypot } = req.body;

    // Honeypot check - silently reject spam
    if (honeypot) {
      // Return success to avoid detection, but don't log
      return res.json({ success: true, message: "Review submitted successfully!" });
    }

    // Validate required fields
    if (!name || !rating || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, rating, and message are required."
      });
    }

    // Validate rating
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5."
      });
    }

    // Create review object
    const review = {
      id: crypto.randomUUID(),
      name: escapeHtml(name),
      city: escapeHtml(city || ""),
      rating: ratingNum,
      message: escapeHtml(message),
      timestamp: new Date().toISOString(),
      status: "pending"
    };

    // Save to storage
    const reviews = await readData(REVIEWS_KEY, REVIEWS_FILE);
    reviews.push(review);
    await writeData(REVIEWS_KEY, REVIEWS_FILE, reviews, MAX_REVIEWS);

    console.log(`Review ${review.id} submitted by ${name}`);

    res.json({
      success: true,
      message: "Thank you for your review! It will be published after approval."
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while submitting your review. Please try again later."
    });
  }
});

// API: Test email (for production testing)
app.post("/api/test-email", testEmailLimiter, async (req, res) => {
  const { key } = req.body;

  if (!process.env.TEST_EMAIL_KEY || key !== process.env.TEST_EMAIL_KEY) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  if (!transporter) {
    return res.json({ success: false, message: "Email not configured" });
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: "Test Email - Valiant Garage Door",
      html: "<h2>Test Email</h2><p>This is a test email from your Valiant Garage Door website.</p>"
    });

    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ success: false, message: "Failed to send test email" });
  }
});

// Handle 404 for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Export for serverless
module.exports = app;

// Start server only if not in serverless environment
if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Storage: ${kv ? "Vercel KV" : "File system"}`);
    console.log(`Email: ${transporter ? "configured" : "not configured"}`);
  });
}
