// getmarcus.app — privacy-conscious analytics loader (single source of truth,
// referenced as <script src="/analytics.js"> from every page: static + generated).
//
// Google Analytics 4 loads ONLY after the visitor accepts. The choice is stored
// in localStorage; declining loads nothing. Once consent is granted, clicks on
// any App Store link fire an `app_store_click` event — the website-side proxy for
// install intent (Apple does not report actual installs back to GA), tagged with
// the CTA's placement so you can see which button drives the most clicks.
(function () {
  var GA_ID = 'G-10SNPQGSRS';
  var KEY = 'marcus-analytics-consent';

  function trackAppStoreClicks() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      var a = el.closest('a[href*="apps.apple.com"]');
      if (!a || !window.gtag) return;
      window.gtag('event', 'app_store_click', {
        link_url: a.href,
        link_text: (a.textContent || '').trim().slice(0, 80),
        placement: a.className || 'link',
      });
    });
  }

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    trackAppStoreClicks();
  }

  function decide(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    var b = document.getElementById('mc-consent');
    if (b && b.parentNode) b.parentNode.removeChild(b);
    if (v === 'granted') loadGA();
  }

  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (choice === 'granted') { loadGA(); return; }
  if (choice === 'denied') { return; }

  function showBanner() {
    if (document.getElementById('mc-consent')) return;
    var style = document.createElement('style');
    style.textContent =
      '#mc-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;max-width:640px;margin:0 auto;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:14px;box-shadow:0 12px 44px rgba(0,0,0,.55);font-family:-apple-system,BlinkMacSystemFont,"Inter",Helvetica,sans-serif}' +
      '#mc-consent p{flex:1;min-width:230px;margin:0;font-size:13px;line-height:1.55;color:#C0C0C0}' +
      '#mc-consent a{color:#B38B5B;text-decoration:none}' +
      '#mc-consent .mc-btns{display:flex;gap:8px}' +
      '#mc-consent button{font-family:inherit;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;cursor:pointer;border:1px solid #2a2a2a;background:transparent;color:#C0C0C0;transition:opacity .15s}' +
      '#mc-consent button:hover{opacity:.85}' +
      '#mc-consent .mc-accept{background:#FFCE82;color:#000;border-color:#FFCE82}';
    document.head.appendChild(style);
    var box = document.createElement('div');
    box.id = 'mc-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Analytics consent');
    box.innerHTML =
      '<p>We use privacy-friendly analytics to see what\'s useful on this site. ' +
      'No ads, and we never sell your data. See our <a href="/privacy">privacy policy</a>.</p>' +
      '<div class="mc-btns"><button type="button" class="mc-decline">Decline</button>' +
      '<button type="button" class="mc-accept">Accept</button></div>';
    document.body.appendChild(box);
    box.querySelector('.mc-accept').addEventListener('click', function () { decide('granted'); });
    box.querySelector('.mc-decline').addEventListener('click', function () { decide('denied'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
