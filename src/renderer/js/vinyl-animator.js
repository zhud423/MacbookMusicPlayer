class VinylAnimator {
  constructor() {
    this.vinylDisc = document.getElementById('vinyl-disc');
    this.tonearm = document.getElementById('tonearm');
    this.isPlaying = false;
  }

  setSpinning(spinning) {
    if (!this.vinylDisc || !this.tonearm) return;

    if (spinning) {
      this.isPlaying = true;
      // 唱针率先落针
      this.tonearm.classList.add('playing');
      
      // 延迟 200ms 唱片开启匀速旋转，拟真物理接触
      setTimeout(() => {
        if (this.isPlaying) {
          this.vinylDisc.classList.remove('stopping');
          this.vinylDisc.classList.add('spinning');
        }
      }, 200);

    } else {
      this.isPlaying = false;
      // 唱针抬起
      this.tonearm.classList.remove('playing');
      this.tonearm.classList.remove('playing-track');

      // 唱片进入减速缓动平滑停止
      this.vinylDisc.classList.remove('spinning');
      this.vinylDisc.classList.add('stopping');
    }
  }

  updateProgressAngle(percent) {
    if (!this.isPlaying || !this.tonearm) return;

    // 根据歌曲进度从 0% 到 100%，唱针在内轨间旋转 -8 度的视角变化
    const maxAngle = -8.0; 
    const angle = (percent / 100) * maxAngle;
    this.tonearm.style.setProperty('--progress-angle', `${angle}deg`);
    this.tonearm.classList.add('playing-track');
  }

  reset() {
    this.setSpinning(false);
    if (this.tonearm) {
      this.tonearm.style.setProperty('--progress-angle', '0deg');
    }
  }
}
