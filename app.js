// Plesk / Phusion Passenger entry point.
//
// Plesk's Node.js integration defaults its "Application Startup File"
// to `app.js` at the application root. This file simply loads the
// Express server, which listens on `process.env.PORT` (set by Plesk).
//
// You can also point Plesk directly at `server/index.js` if you prefer;
// this wrapper is just a convenience so the defaults "just work".
import './server/index.js';
