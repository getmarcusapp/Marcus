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

// Four items plus a wordmark plus the CTA do not fit a phone. Measured on the
// built pages: the bar is 74px at 768px wide and 126px at 390px, because it
// wraps to two lines, which is 15% of an iPhone viewport spent on navigation
// before any content. Below 720px the two section links are hidden and the
// footer carries them, which is exactly where /learn was before this change.
// Shared chrome CSS: the mobile nav rule, plus a focus ring.
//
// The focus ring is here because the site had none. On a near-black background
// the browser default outline is close to invisible, and the one page that
// styled focus at all did it by removing the outline from a textarea. Anyone
// navigating by keyboard could not see where they were. :focus-visible keeps it
// off mouse clicks, so nothing changes for pointer users.
function navCss(prefix) {
  return '@media (max-width:720px){.' + prefix + '-nav-secondary{display:none}}' +
    'a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{' +
    'outline:2px solid #c9a961;outline-offset:3px;border-radius:3px}' +
    '.' + prefix + '-skip{position:absolute;left:-9999px;top:0;z-index:100;' +
    'background:#c9a961;color:#0d0d0f;padding:10px 16px;border-radius:0 0 8px 0;' +
    'font-size:14px;text-decoration:none}' +
    '.' + prefix + '-skip:focus{left:0}';
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
    .map(([href, label], i) => '<a class="' + prefix + '-nav-link' +
      (i > 0 ? ' ' + prefix + '-nav-secondary' : '') + '" href="' + href + '">' + label + '</a>')
    .join('');
  return '<nav class="' + prefix + '-nav">' +
    '<a class="' + prefix + '-brand" href="/"><img src="/skull-gold.png" alt="Marcus" width="36" height="36"><span>Marcus</span></a>' +
    '<div class="' + prefix + '-nav-right">' + links +
    '<a class="' + prefix + '-nav-cta" href="' + CTA[0] + '">' + CTA[1] + '</a>' +
    '</div></nav>';
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

module.exports = { ITEMS, CTA, navHtml, navCss, fontLinks, skipLink, FONT_URL };
