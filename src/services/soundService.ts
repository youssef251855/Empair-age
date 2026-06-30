import { Howl, Howler } from 'howler';

// Singleton for managing game sounds
class SoundService {
  private sounds: Record<string, Howl> = {};
  private isMuted: boolean = false;

  constructor() {
    this.isMuted = localStorage.getItem('soundMuted') === 'true';
    Howler.mute(this.isMuted);

    // Initialize core sounds (Using synthetic beeps for tactical feel since we don't have assets)
    // In a real app we'd load mp3s, but here we can just use short base64 or rely on UI
  }

  public playSound(name: string) {
    if (this.sounds[name]) {
      this.sounds[name].play();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    localStorage.setItem('soundMuted', this.isMuted.toString());
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }
}

export const soundManager = new SoundService();
