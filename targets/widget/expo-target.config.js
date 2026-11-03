/**
 * The Marcus home-screen and lock-screen widget: today's quote, the same one
 * the Practice screen shows. The app writes the next fourteen days of quotes
 * into the shared App Group (lib/widget.js); the widget only reads them, so
 * the quote list has one source, constants/quotes.js, and cannot drift.
 *
 * Built by @bacons/apple-targets on `npx expo prebuild`. Edit here, not in
 * ios/, which is regenerated.
 */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  name: 'MarcusWidget',
  displayName: 'Marcus',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    background: '#0d0d0f',
    gold: '#c9a961',
    cream: '#e8e4dc',
  },
  images: {
    skull: '../../assets/skull-gold.png',
    skullMono: './skull-mono.png',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
