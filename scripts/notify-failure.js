#!/usr/bin/env node
/**
 * Workflow-level backstop notice.
 *
 * generate-newsletter.js emails Gio itself for the failures it can see: every
 * attempt rejected, an empty reserve bank, an unhandled throw. This covers the
 * ones it cannot, because it never got to run — checkout, npm install, a killed
 * runner. Called from the `if: failure()` step, and deliberately never fails the
 * job itself: a missing notice must not become a second red X.
 */
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_TO = process.env.MAIL_TO || MAIL_USER;
const RUN_URL = process.env.RUN_URL || '(no run url)';

(async () => {
  if (!(MAIL_USER && MAIL_PASS)) return;
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch { return; }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
  });
  const today = new Date().toISOString().slice(0, 10);
  await transporter.sendMail({
    from: MAIL_USER, to: MAIL_TO,
    subject: 'Daily Meditations: the run failed (' + today + ')',
    text: 'The Daily Meditations workflow failed and no edition was staged.\n\n'
      + RUN_URL + '\n\n'
      + 'If the generator itself failed it will have sent a more specific note as well.\n'
      + 'Re-run from the Actions tab when you want another attempt.\n',
  });
  console.log('Failure notice emailed to ' + MAIL_TO);
})().catch(e => { console.warn('notify-failure: ' + e.message); });
