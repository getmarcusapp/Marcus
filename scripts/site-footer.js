/**
 * One footer, used by every page builder.
 *
 * Each builder used to hand-write its own, and they had drifted into eight
 * different link sets. The practical consequence: /check-a-stoic-quote and
 * /stoic-quotes shipped linked from exactly one page on the site, /learn, so
 * neither a reader nor a crawler could reach them from anywhere else. A tool
 * nobody can find is not a tool.
 *
 * Each builder styles its own footer, so the CSS prefix is a parameter. Add a
 * destination here and every generated page gets it on the next build.
 */
const LINKS = [
  ['/', 'getmarcus.app'],
  ['/learn', 'Learn'],
  ['/stoics', 'The Stoics'],
  ['/library', 'The Library'],
  ['/stoic-quotes', 'Sourced quotes'],
  ['/check-a-stoic-quote', 'Check a quote'],
  ['/misattributed-stoic-quotes', 'Attribution'],
  ['/meditations', 'Daily Meditations'],
  ['/about', 'About'],
];

// `prefix` is the builder's CSS class prefix: ar, st, mq, tq, qc, lb.
// `omit` drops the link to the page being built, so a page does not link to
// itself in its own footer.
function footerHtml(prefix, omit) {
  const skip = new Set([].concat(omit || []));
  const links = LINKS
    .filter(([href]) => !skip.has(href))
    .map(([href, label]) => '<a href="' + href + '">' + label + '</a>')
    .join(' &middot; ');
  return '<footer class="' + prefix + '-footer"><p>Marcus &middot; A Stoic Practice App &middot; ' + links + '</p></footer>';
}

module.exports = { LINKS, footerHtml };
