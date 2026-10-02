# MTC Event Registration (Trial)

This is a public-facing demo for the MTC student event. The registration form is not connected to a database and does not save submissions. Do not use it to collect real student information.

## Run locally

Install Node.js, then run these commands from the project folder:

```sh
npm install
npm start
```

Open http://localhost:3000. The health check at http://localhost:3000/api/health should return `{"status":"ok"}`.

## Deploy on Render

1. Sign in to Render and create a new Web Service.
2. Connect the private GitHub repository `Rithwik208-ai/mtc-event-registration-trial` and grant Render access to it.
3. Use the repository root as the Root Directory, `npm install` as the Build Command, and `npm start` as the Start Command.
4. Set the Health Check Path to `/api/health`, then create the service.
5. When deployment finishes, open the public `https://...onrender.com` URL and append `/api/health` to verify the server.

Anyone with the service URL can visit the demo. Registration submissions are not saved, so this is only a visual trial until registration storage and suitable production protections are implemented. A free Render service may pause after inactivity.
