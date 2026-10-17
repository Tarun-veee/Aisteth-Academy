import { app } from './app.js';
import { ENV } from './infrastructure/config/env.js';

const PORT = ENV.PORT;

app.listen(PORT, () => {
  console.log(`[AiSteth Backend] Server listening on http://localhost:${PORT}`);
  console.log(`[AiSteth Backend] Environment: ${ENV.NODE_ENV}`);
  console.log(`[AiSteth Backend] Firebase Project: ${ENV.FIREBASE_PROJECT_ID}`);
});
