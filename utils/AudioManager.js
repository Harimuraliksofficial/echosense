class AudioManager {
  constructor() {
    this.isMicLocked = false;
    this.listeners = [];
  }

  lockMic() {
    this.isMicLocked = true;
    this._notify();
  }

  releaseMic() {
    this.isMicLocked = false;
    this._notify();
  }

  canUseMic() {
    return !this.isMicLocked;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  _notify() {
    this.listeners.forEach(cb => cb(this.isMicLocked));
  }
}

export const audioManager = new AudioManager();
export default audioManager;
