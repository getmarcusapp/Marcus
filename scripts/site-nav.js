/**
 * One header nav, used by every page builder.
 *
 * Same story as site-footer.js: each builder wrote its own, all of them
 * identical and all of them carrying two links, so nothing built in the last
 * month appeared in the header of any page. The site now has five real
 * sections and the header named one of them.
 *
 * Four items, flat, no dropdowns. At 52 URLs across five sections a plain bar
 * carries the structure, and a hover menu would be a desktop-only affordance
 * on a site that mostly sells an iOS app. Each section already has an index
 * page, which is the thing worth linking to: a hub can be crawled, ranked and
 * shared, and a menu that exists only on hover cannot.
 *
 * If a dropdown is ever added, the bar for it is a section with four or more
 * children worth surfacing, opened on click rather than hover, and reachable
 * from the keyboard.
 *
 * `prefix` is the builder's CSS class prefix (ar, st, mq, tq, qc, lb, ln, ab,
 * dm). `current` drops the link to the page being rendered, and is deliberately
 * NOT used by the section builders: /stoic-quotes/death needs the Quotes link
 * more than the hub does, because it is the way back up. The footer omits
 * self-links, the nav does not.
 */
const ITEMS = [
  ['/learn', 'Learn'],
  ['/stoics', 'The Stoics'],
  ['/stoic-quotes', 'Quotes'],
];

const CTA = ['/', 'Get the app →'];

// Shared chrome CSS: the mobile menu, a focus ring, and the skip link.
//
// THE MOBILE MENU. Four items plus a wordmark plus the CTA do not fit a phone:
// measured on the built pages, the bar is 74px at 768px and 126px at 390px,
// because it wraps. The first attempt at that was to hide the two section
// links below 720px, which fixed the height by making half the site
// unreachable on a phone. Only the hand-written homepage had a menu; the other
// 117 pages had no way to show a link they had hidden. So: a real menu, the
// links stay, and the panel opens on tap.
//
// THE FOCUS RING, because the site had none. On a near-black background the
// browser default outline is close to invisible, and the one page that styled
// focus at all did it by removing the outline from a textarea. :focus-visible
// keeps it off mouse clicks, so nothing changes for pointer users.
function navCss(prefix) {
  const p = '.' + prefix;
  return (
    // Desktop: the toggle does not exist.
    '@media (min-width:721px){' + p + '-nav-toggle{display:none}}' +
    '@media (max-width:720px){' +
      p + '-nav{flex-wrap:wrap}' +
      p + '-nav-toggle{display:flex;flex-direction:column;justify-content:center;gap:5px;' +
        'width:44px;height:44px;padding:0 10px;background:none;border:0;cursor:pointer}' +
      p + '-nav-toggle span{display:block;height:2px;background:#e8e4dc;border-radius:2px;transition:.2s}' +
      p + '-nav-open ' + p + '-nav-toggle span:nth-child(1){transform:translateY(7px) rotate(45deg)}' +
      p + '-nav-open ' + p + '-nav-toggle span:nth-child(2){opacity:0}' +
      p + '-nav-open ' + p + '-nav-toggle span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}' +
      p + '-nav-right{display:none;flex-basis:100%;flex-direction:column;align-items:stretch;gap:0;padding:4px 0 10px}' +
      p + '-nav-open ' + p + '-nav-right{display:flex}' +
      p + '-nav-right ' + p + '-nav-link{padding:14px 2px;border-top:1px solid rgba(232,228,220,.1)}' +
      p + '-nav-right ' + p + '-nav-cta{margin-top:14px;text-align:center;padding:13px 16px}' +
    '}' +
    'a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{' +
    'outline:2px solid #c9a961;outline-offset:3px;border-radius:3px}' +
    p + '-skip{position:absolute;left:-9999px;top:0;z-index:100;' +
    'background:#c9a961;color:#0d0d0f;padding:10px 16px;border-radius:0 0 8px 0;' +
    'font-size:14px;text-decoration:none}' +
    p + '-skip:focus{left:0}'
  );
}

// Toggles the panel and keeps aria-expanded honest. Inlined next to the nav so
// there is no extra request and no dependency on load order.
function navScript(prefix) {
  return '<script>(function(){var n=document.querySelector(".' + prefix + '-nav");' +
    'if(!n)return;var b=n.querySelector(".' + prefix + '-nav-toggle");if(!b)return;' +
    'b.addEventListener("click",function(){var o=n.classList.toggle("' + prefix + '-nav-open");' +
    'b.setAttribute("aria-expanded",o?"true":"false");});})();</script>';
}

// A skip link, which the site had on none of its 118 pages. Visually hidden
// until focused, so it costs nothing to a mouse user and saves a keyboard user
// tabbing through the whole header on every page. Targets #main, which every
// builder now puts on its content region.
function skipLink(prefix) {
  return '<a class="' + prefix + '-skip" href="#main">Skip to content</a>';
}

function navHtml(prefix, current) {
  const links = ITEMS
    .filter(([href]) => href !== current)
    .map(([href, label]) => '<a class="' + prefix + '-nav-link" href="' + href + '">' + label + '</a>')
    .join('');
  const menuId = prefix + '-menu';
  return '<nav class="' + prefix + '-nav">' +
    '<a class="' + prefix + '-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="36" height="36"><span>Marcus</span></a>' +
    '<button class="' + prefix + '-nav-toggle" type="button" aria-expanded="false" aria-controls="' + menuId + '" aria-label="Menu">' +
    '<span></span><span></span><span></span></button>' +
    '<div class="' + prefix + '-nav-right" id="' + menuId + '">' + links +
    '<a class="' + prefix + '-nav-cta" href="' + CTA[0] + '">' + CTA[1] + '</a>' +
    '</div></nav>' + navScript(prefix);
}

// Fonts were render-blocking on every page: a synchronous stylesheet request
// to a third-party host sits in front of first paint. display=swap already
// meant text drew in a fallback, so the blocking fetch was buying nothing but
// delay. Loaded with media="print" and switched to all on load, with a
// noscript copy so it still works without JavaScript.
//
// One URL for the whole site. There were two, differing in weights, and the
// lighter one was on eight pages, which meant a second font fetch for anyone
// crossing between them.
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:ital,wght@0,400;0,500;1,300;1,400&display=swap';

function fontLinks() {
  return '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="preload" as="style" href="' + FONT_URL + '">' +
    '<link rel="stylesheet" href="' + FONT_URL + '" media="print" onload="this.media=\'all\';this.onload=null">' +
    '<noscript><link rel="stylesheet" href="' + FONT_URL + '"></noscript>';
}

module.exports = { ITEMS, CTA, navHtml, navCss, navScript, fontLinks, skipLink, FONT_URL };
