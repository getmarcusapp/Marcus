/**
 * When a page's content last changed, according to git.
 *
 * Extracted from build-archive.js because two builders now need the same
 * answer and they must not disagree. The sitemap dates
 * /misattributed-stoic-quotes from constants/misattributions.js; the page's own
 * Article schema needs a dateModified, and if that were computed some other way
 * the site would be telling Google two different dates for one page. One
 * function, one answer.
 *
 * git rather than the filesystem: mtime is whenever the file was last written,
 * which on a machine that just ran a build is "now" for everything, and on a
 * fresh clone is the checkout time for everything. The commit date is when the
 * content actually changed.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

function gitDate(relPath) {
  try {
    const out = require('child_process')
      .execSync('git log -1 --format=%cs -- ' + JSON.stringify(relPath), {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .toString()
      .trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

// The newest of several sources. A page changes when its data changes OR when
// the builder that renders it changes, and either one is a real edit.
const newestDate = (...paths) => paths.map(gitDate).filter(Boolean).sort().pop() || null;

// The first time a file was committed, for datePublished. Distinct from
// newestDate: a reference page that keeps growing should not claim to have been
// published on the day its most recent entry was added.
function firstGitDate(relPath) {
  try {
    const out = require('child_process')
      .execSync('git log --reverse --format=%cs -- ' + JSON.stringify(relPath), {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .toString()
      .split('\n')[0]
      .trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

module.exports = { gitDate, newestDate, firstGitDate };
