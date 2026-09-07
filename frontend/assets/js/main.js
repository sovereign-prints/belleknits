/* ---------------------------------------------------------------
   SHARED BEHAVIOUR
   Rendering helpers used by the public pages. Every renderer falls
   back to placeholder content when the backend is unreachable, so
   the static site is always browsable.
   --------------------------------------------------------------- */
(function (window, document) {
  'use strict';

  var CFG = window.SITE_CONFIG;
  var API = window.SiteAPI;

  // sample-data.js is a development convenience and build-static.sh strips it
  // from production builds, so this must survive its absence.
  var SAMPLE = window.SITE_SAMPLE || { products: [], gallery: [] };

  /* ---- utilities ---- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function money(n) {
    return CFG.CURRENCY + Number(n).toLocaleString('en-ZA');
  }

  function stockLabel(s) {
    return { 'in-stock':'In stock', 'low':'Low stock', 'made-to-order':'Made to order' }[s] || '';
  }

  function whatsappLink() {
    return 'https://wa.me/' + CFG.WHATSAPP_NUMBER;
  }

  function friendly(message) {
    return '<div class="notice notice-warn">' + esc(message) +
      ' <a href="' + whatsappLink() + '" rel="noopener">Message us on WhatsApp</a>.</div>';
  }

  /* ---- navigation ---- */

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.nav');

    if (toggle && nav) {
      function close() {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', nav.classList.contains('is-open'));
      });

      // Tapping anywhere else, or pressing Escape, closes the menu —
      // on a phone an open menu covers the page.
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('is-open') && !nav.contains(e.target)) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
    }

    var here = currentPage();
    Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
      if (a.getAttribute('href') === here) a.classList.add('is-active');
    });
  }

  /* ---- sticky action bar (phones only; CSS hides it on desktop) ----
     The nav lives behind a hamburger on a phone, so the two actions
     that matter most get a permanent place at thumb height. The
     second button changes to suit the page you are on. */

  function initActionBar() {
    var here = currentPage();

    // The quote page IS the action. A bar there would only cover the
    // form it points at.
    if (here === 'bespoke.html') {
      document.body.classList.add('no-action-bar');
      return;
    }

    var primary = (here === 'about.html' || here === '404.html')
      ? { href: 'shop.html',    label: 'Browse the shop' }
      : { href: 'bespoke.html', label: 'Request a quote' };

    var bar = document.createElement('div');
    bar.className = 'action-bar';
    bar.innerHTML =
      '<a class="btn btn-primary" href="' + primary.href + '">' + primary.label + '</a>' +
      '<a class="btn btn-ghost btn-wa" href="' + whatsappLink() + '" rel="noopener" ' +
        'aria-label="Message us on WhatsApp">Chat</a>';
    document.body.appendChild(bar);
  }

  /* ---- product rendering ---- */

  function productCard(p) {
    var meta = [p.weight, p.fibre, p.unit].filter(Boolean).join(' · ');
    return '' +
      '<article class="card">' +
        '<div class="card-figure" data-cat="' + esc(p.category) + '"></div>' +
        '<div class="card-body">' +
          '<h3>' + esc(p.name) + '</h3>' +
          (meta ? '<div class="card-meta">' + esc(meta) + '</div>' : '') +
          '<p class="card-blurb">' + esc(p.blurb) + '</p>' +
          '<div class="card-foot">' +
            '<span class="price">' + money(p.price) +
              (p.metreage ? '<small>' + esc(p.metreage) + ' per ' + esc(p.unit) + '</small>' : '') +
            '</span>' +
            (p.stock ? '<span class="tag tag-' + esc(p.stock) + '">' + esc(stockLabel(p.stock)) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderProducts(container, list) {
    if (!list.length) {
      container.innerHTML = '<div class="notice notice-info">Nothing in this category just yet — check back soon.</div>';
      return;
    }
    container.className = 'grid';
    container.innerHTML = list.map(productCard).join('');
  }

  function loadProducts(opts) {
    opts = opts || {};
    var container = document.getElementById(opts.target || 'products');
    if (!container) return;

    var state = { all: [], category: 'all' };

    function paint() {
      var list = state.category === 'all'
        ? state.all
        : state.all.filter(function (p) { return p.category === state.category; });
      if (opts.limit) list = list.slice(0, opts.limit);
      renderProducts(container, list);
    }

    API.getProducts().then(function (res) {
      if (res.ok && Array.isArray(res.data) && res.data.length) {
        state.all = res.data;
        paint();
        return;
      }
      // Backend asleep or not yet deployed. In development the placeholder
      // catalogue stands in; in production it has been stripped from the
      // build, so say something friendly rather than showing an empty page.
      if (SAMPLE.products.length) {
        state.all = SAMPLE.products;
        paint();
        return;
      }
      container.className = '';
      container.innerHTML = friendly(res.message || API.FRIENDLY_MESSAGE);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.filter'), function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.filter'), function (b) {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        state.category = btn.dataset.category;
        paint();
      });
    });
  }

  /* ---- gallery rendering ---- */

  function loadGallery(opts) {
    opts = opts || {};
    var container = document.getElementById(opts.target || 'gallery');
    if (!container) return;

    API.getGallery().then(function (res) {
      var items = (res.ok && Array.isArray(res.data) && res.data.length) ? res.data : SAMPLE.gallery;
      if (!items.length) {
        container.className = '';
        container.innerHTML = friendly(res.message || API.FRIENDLY_MESSAGE);
        return;
      }
      if (opts.limit) items = items.slice(0, opts.limit);
      container.className = 'gallery-grid';
      container.innerHTML = items.map(function (g) {
        return '' +
          '<figure class="gallery-item">' +
            '<div class="gallery-figure"></div>' +
            '<figcaption class="gallery-cap">' +
              '<strong>' + esc(g.title) + '</strong>' +
              '<span>' + esc(g.note || '') + '</span>' +
            '</figcaption>' +
          '</figure>';
      }).join('');
    });
  }

  /* ---- quote form ---- */

  function initQuoteForm() {
    var form = document.getElementById('quote-form');
    if (!form) return;

    var status = document.getElementById('quote-status');
    var submit = form.querySelector('button[type=submit]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });

      if (!data.name || !data.email || !data.project) {
        status.innerHTML = '<div class="notice notice-warn">Please fill in your name, email address and a short description of what you would like made.</div>';
        return;
      }

      submit.disabled = true;
      var original = submit.textContent;
      submit.textContent = 'Sending…';
      status.innerHTML = '<div class="notice notice-info">Sending your request…</div>';

      API.submitQuote(data).then(function (res) {
        submit.disabled = false;
        submit.textContent = original;

        if (res.ok) {
          form.reset();
          status.innerHTML = '<div class="notice notice-success">' +
            'Thank you — your request has arrived. We will come back to you within two working days with a quote.' +
            '</div>';
          status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Never show the customer a server or database error.
          status.innerHTML = friendly(res.message || API.FRIENDLY_SUBMIT_MESSAGE);
          status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  /* ---- footer year + whatsapp links ---- */

  function initChrome() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
    Array.prototype.forEach.call(document.querySelectorAll('[data-whatsapp]'), function (a) {
      a.href = whatsappLink();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-email]'), function (a) {
      a.href = 'mailto:' + CFG.EMAIL;
      if (a.dataset.email === 'text') a.textContent = CFG.EMAIL;
    });
  }

  window.Site = {
    init: function (opts) {
      opts = opts || {};
      initNav();
      initChrome();
      initActionBar();
      if (opts.products) loadProducts(opts.products);
      if (opts.gallery) loadGallery(opts.gallery);
      if (opts.quoteForm) initQuoteForm();
    }
  };
})(window, document);
