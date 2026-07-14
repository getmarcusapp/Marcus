const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Xcode 26+ Clang enforces `consteval` strictly, which breaks React Native
// 0.81's vendored `fmt` ("call to consteval function ... is not a constant
// expression" in Pods/fmt/format-inl.h). This plugin re-applies the Podfile
// post_install patch on every `expo prebuild`, so the CNG-managed (gitignored)
// ios/ project keeps compiling under the newer LOCAL toolchain.
//
// No effect on EAS builds — they run an older, RN-matched Xcode where fmt
// compiles fine, and this only relaxes a compile-time check (FMT_USE_CONSTEVAL
// falls back to constexpr), so runtime behavior is unchanged either way.
//
// The identical patch is also written directly into ios/Podfile so the current
// checkout builds without a re-prebuild; keep the two in sync.

// Anchor: the closing of Expo SDK 54's generated react_native_post_install call.
// If a future SDK changes this template, update the anchor (the plugin warns
// loudly rather than silently skipping).
const ANCHOR =
  '      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n';

// A -DFMT_USE_CONSTEVAL=0 flag does NOT work: fmt's base.h redefines the macro
// unconditionally from compiler detection, overriding the flag. Xcode 26+ clang
// advertises __cpp_consteval so fmt turns consteval on, then rejects its own
// consteval checks. So force the macro off directly in the header (re-applied
// on every pod install, since ios/Pods is regenerated).
const PATCH = `    # [withFmtConsteval] force fmt consteval OFF so it builds under Xcode 26+.
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      text = File.read(fmt_base)
      if text.include?('#  define FMT_USE_CONSTEVAL 1')
        File.write(fmt_base, text.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0'))
        Pod::UI.puts '[fmt] forced FMT_USE_CONSTEVAL 0 for Xcode 26+ compatibility'
      end
    end
`;

module.exports = function withFmtConsteval(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      // Idempotent: the PATCH carries the [withFmtConsteval] tag.
      if (!contents.includes('[withFmtConsteval]')) {
        if (contents.includes(ANCHOR)) {
          contents = contents.replace(ANCHOR, ANCHOR + PATCH);
          fs.writeFileSync(podfilePath, contents);
        } else {
          console.warn(
            '[withFmtConsteval] Podfile anchor not found — fmt consteval patch ' +
              'was NOT applied. The generated Podfile template likely changed; ' +
              'update ANCHOR in plugins/withFmtConsteval.js.',
          );
        }
      }
      return cfg;
    },
  ]);
};
