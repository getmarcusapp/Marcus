import ExpoModulesCore
import MediaPlayer
import UIKit

// Publishes the playing meditation to the lock screen and Control Center and
// relays the remote buttons (play, pause, ±15 s, scrubbing) back to JS as
// onRemoteCommand events. Elapsed time is set on play, pause and seek only:
// iOS advances it from the playback rate in between.
public class NowPlayingModule: Module {
  private var commandsReady = false
  private var artworkUri: String?
  private var artwork: MPMediaItemArtwork?

  public func definition() -> ModuleDefinition {
    Name("NowPlaying")
    Events("onRemoteCommand")

    Function("update") { (title: String, artist: String, album: String, artworkUri: String?, duration: Double, position: Double, playing: Bool) in
      DispatchQueue.main.async {
        self.ensureCommands()
        var info: [String: Any] = [
          MPMediaItemPropertyTitle: title,
          MPMediaItemPropertyArtist: artist,
          MPMediaItemPropertyAlbumTitle: album,
          MPMediaItemPropertyPlaybackDuration: duration,
          MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
          MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
          MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
        ]
        if let art = self.loadArtwork(artworkUri) { info[MPMediaItemPropertyArtwork] = art }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }

    Function("clear") {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
    }
  }

  private func loadArtwork(_ uri: String?) -> MPMediaItemArtwork? {
    guard let uri = uri else { return nil }
    if uri == artworkUri { return artwork }
    let path = URL(string: uri)?.path ?? uri
    guard let image = UIImage(contentsOfFile: path) else { return nil }
    artworkUri = uri
    artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    return artwork
  }

  private func ensureCommands() {
    if commandsReady { return }
    commandsReady = true
    let c = MPRemoteCommandCenter.shared()
    let send = { [weak self] (command: String, position: Double) -> MPRemoteCommandHandlerStatus in
      self?.sendEvent("onRemoteCommand", ["command": command, "position": position])
      return .success
    }
    c.playCommand.isEnabled = true
    c.playCommand.addTarget { _ in send("play", 0) }
    c.pauseCommand.isEnabled = true
    c.pauseCommand.addTarget { _ in send("pause", 0) }
    c.togglePlayPauseCommand.isEnabled = true
    c.togglePlayPauseCommand.addTarget { _ in send("toggle", 0) }
    c.skipForwardCommand.isEnabled = true
    c.skipForwardCommand.preferredIntervals = [15]
    c.skipForwardCommand.addTarget { _ in send("forward", 0) }
    c.skipBackwardCommand.isEnabled = true
    c.skipBackwardCommand.preferredIntervals = [15]
    c.skipBackwardCommand.addTarget { _ in send("back", 0) }
    c.changePlaybackPositionCommand.isEnabled = true
    c.changePlaybackPositionCommand.addTarget { event in
      guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      return send("seek", e.positionTime)
    }
    // Skip buttons, not track buttons: a meditation is one track.
    c.nextTrackCommand.isEnabled = false
    c.previousTrackCommand.isEnabled = false
  }
}
