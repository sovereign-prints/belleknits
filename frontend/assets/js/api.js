/* ---------------------------------------------------------------
   API CLIENT
   Wraps every call to the Render Web Service.

   Free-tier rule: the static site must keep working when the
   backend is asleep or unavailable. Every method resolves with
   { ok, data, offline } and NEVER throws a technical error at the
   customer. Callers render placeholder content or a friendly
   message when ok === false.
   --------------------------------------------------------------- */
(function (window) {
  'use strict';

  var CFG = window.SITE_CONFIG;

  var FRIENDLY_MESSAGE =
    "We're temporarily unable to load this right now. " +
    'Please try again shortly or contact us on WhatsApp.';

  var FRIENDLY_SUBMIT_MESSAGE =
    "We're temporarily unable to process your request. " +
    'Please try again shortly or contact us on WhatsApp.';

  function request(path, options) {
    options = options || {};

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, CFG.REQUEST_TIMEOUT_MS);

    var init = {
      method: options.method || 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // No cookies. Nothing the public site calls is authenticated, and the
      // admin dashboard is served by the API host itself, so its session
      // cookie is same-origin and never travels from here. Sending
      // credentials cross-origin would also force the backend to enable
      // Access-Control-Allow-Credentials, which it deliberately does not.
      credentials: 'omit'
    };

    if (options.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    return window
      .fetch(CFG.API_BASE_URL + path, init)
      .then(function (res) {
        window.clearTimeout(timer);

        if (!res.ok) {
          // Log the technical detail for us; show nothing to the customer.
          console.warn('[api] ' + path + ' responded ' + res.status);
          return {
            ok: false,
            offline: res.status >= 500 || res.status === 503,
            status: res.status,
            message: options.method && options.method !== 'GET'
              ? FRIENDLY_SUBMIT_MESSAGE
              : FRIENDLY_MESSAGE
          };
        }

        return res.json().then(function (data) {
          return { ok: true, data: data, offline: false };
        });
      })
      .catch(function (err) {
        window.clearTimeout(timer);
        console.warn('[api] ' + path + ' failed:', err && err.message);
        return {
          ok: false,
          offline: true,
          message: options.method && options.method !== 'GET'
            ? FRIENDLY_SUBMIT_MESSAGE
            : FRIENDLY_MESSAGE
        };
      });
  }

  window.SiteAPI = {
    FRIENDLY_MESSAGE: FRIENDLY_MESSAGE,
    FRIENDLY_SUBMIT_MESSAGE: FRIENDLY_SUBMIT_MESSAGE,

    getProducts: function (category) {
      var q = category && category !== 'all' ? '?category=' + encodeURIComponent(category) : '';
      return request('/products' + q);
    },

    getProduct: function (slug) {
      return request('/products/' + encodeURIComponent(slug));
    },

    getGallery: function () {
      return request('/gallery');
    },

    getSettings: function () {
      return request('/settings');
    },

    submitQuote: function (payload) {
      return request('/quotes', { method: 'POST', body: payload });
    },

    submitOrder: function (payload) {
      return request('/orders', { method: 'POST', body: payload });
    }
  };
})(window);
