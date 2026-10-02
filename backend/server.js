const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(express.json());
app.use(express.static(frontendPath));

app.get("/api/health", (request, response) => {
  response.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`MTC registration app is listening on port ${port}`);
});
