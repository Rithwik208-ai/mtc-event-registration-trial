const dotenv = require("dotenv");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const MongoStore = require("connect-mongo").MongoStore;
const path = require("path");
const mongoose = require("mongoose");
const adminRoutes = require("./routes/adminRoutes");
const registrationRoutes = require("./routes/registrationRoutes");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const port =
  process.env.PORT === undefined || process.env.PORT === ""
    ? 3000
    : Number(process.env.PORT);
const frontendPath = path.join(__dirname, "..", "frontend");
let appConfigured = false;

function configurationError(message) {
  const error = new Error(message);
  error.name = "ConfigurationError";
  return error;
}

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

function configureApp() {
  if (appConfigured) {
    return;
  }

  app.use(
    session({
      name: "mtc.sid",
      secret: process.env.SESSION_SECRET,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: "sessions",
        ttl: 8 * 60 * 60,
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  app.get("/api/health", (request, response) => {
    const connected = mongoose.connection.readyState === 1;
    return response.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "unavailable",
      database: connected ? "connected" : "disconnected",
    });
  });

  app.use("/api/admin", adminRoutes);
  app.use("/api/registrations", registrationRoutes);
  app.get("/admin", (request, response) => {
    response.sendFile(path.join(frontendPath, "admin.html"));
  });
  app.use(express.static(frontendPath));

  app.use("/api", (request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      return next(error);
    }

    if (error.type === "entity.too.large") {
      return response.status(413).json({ error: "Request body is too large." });
    }
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      return response.status(400).json({ error: "Request body must be valid JSON." });
    }

    console.error("Request failed:", {
      name: error.name || "Error",
      code: error.code || "unavailable",
    });
    return response.status(500).json({ error: "An unexpected server error occurred." });
  });

  appConfigured = true;
}

async function startServer() {
  for (const name of ["MONGODB_URI", "ADMIN_API_KEY", "SESSION_SECRET"]) {
    if (!process.env[name]) {
      throw configurationError(`${name} is required in the project .env file.`);
    }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw configurationError("PORT must be a valid TCP port number.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.model("Registration").init();
  configureApp();
  console.log("Connected to MongoDB.");

  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once("listening", () => {
      console.log(`MTC registration app is listening on port ${port}`);
      resolve(server);
    });
    server.once("error", (error) => {
      reject(error);
    });
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    const details = {
      name: error.name || "Error",
      code: error.code || "unavailable",
    };
    if (error.name === "ConfigurationError") {
      details.configuration = error.message;
    }
    console.error("Unable to start the MTC registration app:", details);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { app, configureApp, startServer };
