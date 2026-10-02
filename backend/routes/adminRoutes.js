const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { requireAdmin, requireAdminCsrf, safelyMatches } = require("../middleware/requireAdmin");

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Please try again later." },
});

router.get("/session", (request, response) => {
  return response.json({
    authenticated: request.session?.isAdmin === true,
    csrfToken: request.session?.isAdmin === true ? request.session.csrfToken : null,
  });
});

router.post("/login", loginLimiter, (request, response, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = request.body?.accessKey;

  if (!configuredKey) {
    return response.status(503).json({
      error: "Administrator access is not configured.",
    });
  }
  if (!safelyMatches(configuredKey, providedKey)) {
    return response.status(401).json({ error: "Access key is invalid." });
  }

  return request.session.regenerate((error) => {
    if (error) {
      return next(error);
    }
    request.session.isAdmin = true;
    request.session.csrfToken = crypto.randomBytes(32).toString("hex");
    return request.session.save((saveError) => {
      if (saveError) {
        return next(saveError);
      }
      return response.json({
        authenticated: true,
        csrfToken: request.session.csrfToken,
      });
    });
  });
});

router.post("/logout", requireAdmin, requireAdminCsrf, (request, response, next) => {
  return request.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    response.clearCookie("mtc.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response.json({ message: "Logged out." });
  });
});

module.exports = router;
