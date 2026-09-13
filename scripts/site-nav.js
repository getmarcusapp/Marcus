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
function navCss(prefix) {
  return '@media (max-width:720px){.' + prefix + '-nav-secondary{display:none}}';
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

module.exports = { ITEMS, CTA, navHtml, navCss };
