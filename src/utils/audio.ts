// Web Audio API Synthesized Sound & Dynamic Background Music System for Pokémon Rogue Dungeon

class SoundSystem {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private currentBgm: 'none' | 'dungeon' | 'battle' | 'boss' = 'none';
  private bgmTimer: any = null;
  private bgmGain: GainNode | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        // If BGM was queued before user interaction, resume it now
        if (this.currentBgm === 'dungeon' && this.dungeonAudio && this.dungeonAudio.paused) {
          this.dungeonAudio.play().catch(() => {});
        } else if ((this.currentBgm === 'battle' || this.currentBgm === 'boss') && this.battleAudio && this.battleAudio.paused) {
          this.battleAudio.play().catch(() => {});
        }

        if (this.ctx && this.ctx.state === 'running') {
          this.isUnlocked = true;
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('touchstart', unlock);
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public volume: number = 0.7;

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.dungeonAudio) {
      this.dungeonAudio.volume = this.volume * 0.7;
    }
    if (this.battleAudio) {
      this.battleAudio.volume = this.volume * 0.8;
    }
  }

  public unlockAudio() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private init() {
    this.unlockAudio();
  }

  // --- SOUND EFFECTS ---
  public playSelect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playHit(superEffective: boolean = false, notEffective: boolean = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (superEffective) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } else if (notEffective) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    }
  }

  public playLevelUp() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.14, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.2);
    });
  }

  public playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [
      { f: 523.25, d: 0.12 },
      { f: 523.25, d: 0.12 },
      { f: 523.25, d: 0.12 },
      { f: 523.25, d: 0.25 },
      { f: 415.3, d: 0.25 },
      { f: 466.16, d: 0.25 },
      { f: 523.25, d: 0.4 },
    ];

    let t = this.ctx.currentTime;
    notes.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + note.d);
      t += note.d + 0.03;
    });
  }

  public playPokeballShake() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playCaught() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }

  public playFaint() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(65, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  public playRest() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const chords = [392.0, 493.88, 587.33, 783.99];
    const now = this.ctx.currentTime;
    chords.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  private dungeonAudio: HTMLAudioElement | null = null;
  private battleAudio: HTMLAudioElement | null = null;

  private getDungeonAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.dungeonAudio) {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';
      this.dungeonAudio = new Audio();
      this.dungeonAudio.src = `${base}/assets/audio/dungeon_bgm_suno.mp3`;
      this.dungeonAudio.loop = true;
      this.dungeonAudio.volume = this.volume * 0.7;
      this.dungeonAudio.onerror = () => {
        if (this.dungeonAudio) {
          this.dungeonAudio.src = `${base}/assets/audio/dungeon_bgm_suno.m4a`;
        }
      };
    }
    return this.dungeonAudio;
  }

  private getBattleAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.battleAudio) {
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';
      this.battleAudio = new Audio();
      this.battleAudio.src = `${base}/assets/audio/battle_bgm_suno.mp3`;
      this.battleAudio.loop = true;
      this.battleAudio.volume = this.volume * 0.8;
      this.battleAudio.onerror = () => {
        if (this.battleAudio) {
          this.battleAudio.src = `${base}/assets/audio/battle_bgm_suno.mp3`; // fallback
        }
      };
    }
    return this.battleAudio;
  }

  // --- SUNO BACKGROUND MUSIC (BGM) ENGINE ---
  public stopBgm() {
    this.currentBgm = 'none';
    if (this.dungeonAudio) {
      this.dungeonAudio.pause();
      this.dungeonAudio.currentTime = 0;
    }
    if (this.battleAudio) {
      this.battleAudio.pause();
      this.battleAudio.currentTime = 0;
    }
  }

  public startDungeonBgm() {
    if (!this.enabled || this.currentBgm === 'dungeon') return;
    this.stopBgm();
    this.currentBgm = 'dungeon';

    const audio = this.getDungeonAudio();
    if (audio) {
      audio.volume = this.volume * 0.7;
      audio.play().catch((e) => {
        console.warn('Dungeon BGM playback failed, awaiting interaction:', e);
      });
    }
  }

  public startBattleBgm(isBoss: boolean = false) {
    if (!this.enabled || (this.currentBgm === 'battle' && !isBoss)) return;
    this.stopBgm();
    this.currentBgm = isBoss ? 'boss' : 'battle';

    const audio = this.getBattleAudio();
    if (audio) {
      audio.volume = isBoss ? this.volume * 0.9 : this.volume * 0.8;
      audio.play().catch((e) => {
        console.warn('Battle BGM playback failed, awaiting interaction:', e);
      });
    }
  }

  public playBattleTriggerSound() {
    if (!this.enabled) return;

    this.unlockAudio();
    if (!this.ctx) return;

    const playNotes = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Classic Pokémon Encounter SFX: Rapid ascending arpeggio (E5, G#5, B5, E6, G#6, B6)
      const notes = [659.25, 830.61, 987.77, 1318.51, 1661.22, 1975.53];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);

        gain.gain.setValueAtTime(0.22, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.14);
      });
    };

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => playNotes()).catch(() => playNotes());
    } else {
      playNotes();
    }
  }
}

export const sound = new SoundSystem();
