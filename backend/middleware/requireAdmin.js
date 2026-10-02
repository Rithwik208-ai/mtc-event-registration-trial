const { timingSafeEqual } = require("crypto");

function safelyMatches(expectedValue, providedValue) {
  if (typeof providedValue !== "string") {
    return false;
  }

  const expected = Buffer.from(expectedValue);
  const provided = Buffer.from(providedValue);
  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
}

function requireAdmin(request, response, next) {
  if (request.session?.isAdmin !== true) {
    return response.status(401).json({ error: "Administrator login required." });
  }
  return next();
}

function requireAdminCsrf(request, response, next) {
  const expectedToken = request.session?.csrfToken;
  const providedToken = request.get("x-csrf-token");
  if (!expectedToken || !safelyMatches(expectedToken, providedToken)) {
    return response.status(403).json({ error: "Request verification failed." });
  }
  return next();
}

module.exports = { requireAdmin, requireAdminCsrf, safelyMatches };
