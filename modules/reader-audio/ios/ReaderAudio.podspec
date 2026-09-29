Pod::Spec.new do |s|
  s.name           = 'ReaderAudio'
  s.version        = '1.0.0'
  s.summary        = 'Background text-to-speech reader with lock-screen controls'
  s.description    = 'Background text-to-speech reader with lock-screen controls'
  s.license        = 'MIT'
  s.author         = 'Proyecto MR'
  s.homepage       = 'https://expo.dev'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
