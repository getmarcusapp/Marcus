Pod::Spec.new do |s|
  s.name           = 'NowPlaying'
  s.version        = '1.0.0'
  s.summary        = 'Lock screen Now Playing for Marcus meditations'
  s.author         = 'Harvana'
  s.homepage       = 'https://getmarcus.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
