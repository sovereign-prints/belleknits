/* ---------------------------------------------------------------
   CENTRAL API CONFIGURATION
   The ONLY place an API URL is defined. Never hardcode an API URL
   anywhere else in the frontend.

   API_HOST is rewritten at build time by build-static.sh when the
   API_HOST environment variable is set on the Render Static Site,
   so the production URL never has to be edited by hand. Keep the
   declaration on one line and in this exact shape — the build script
   matches it with a regex.

   This file contains NO secrets. No database credentials, no Neon
   connection string, no private keys, no admin password.
   --------------------------------------------------------------- */
(function (window) {
  'use strict';

  var API_HOST = 'https://overberg-wool.onrender.com';

  var hostname = window.location.hostname;
  var isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';

  window.SITE_CONFIG = {
    // Render Web Service (backend/API).
    API_BASE_URL: (isLocal ? 'http://localhost:3000' : API_HOST) + '/api',

    // Render's free tier puts the Web Service to sleep. The first request
    // after it sleeps can take ~30s to cold start, so wait before failing.
    REQUEST_TIMEOUT_MS: 30000,

    WHATSAPP_NUMBER: '27000000000',
    EMAIL: 'hello@overbergwool.co.za',

    CURRENCY: 'R'
  };
})(window);
