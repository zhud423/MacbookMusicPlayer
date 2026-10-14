class TrackManager {
  constructor(onTrackClickCallback) {
    this.trackListEl = document.getElementById('track-list');
    this.albumTitleEl = document.getElementById('album-title');
    this.albumArtistEl = document.getElementById('album-artist');
    this.coverImgEl = document.getElementById('album-cover-img');
    this.currentTimeEl = document.getElementById('current-time');
    this.totalDurationEl = document.getElementById('total-duration');
    this.progressFillEl = document.getElementById('progress-bar-fill');
    this.discFormatTagEl = document.getElementById('disc-format-tag');

    this.onTrackClick = onTrackClickCallback;
    this.currentTrackIndex = 1;
    this.tracksData = [];
  }

  renderMetadata(data) {
    if (!data) return;

    this.albumTitleEl.textContent = data.album || 'Unknown Album';
    this.albumArtistEl.textContent = data.artist || 'Unknown Artist';

    if (this.discFormatTagEl) {
      this.discFormatTagEl.textContent = data.isOffline ? 'OFFLINE AUDIO CD' : 'STEREO MUSICBRAINZ CD';
    }

    // 更新封面
    if (data.coverUrl) {
      this.coverImgEl.src = data.coverUrl;
    } else {
      this.coverImgEl.src = 'assets/images/default-cover.jpg';
    }

    // 绘制主色氛围灯
    this.coverImgEl.onload = () => updateAmbientLighting(this.coverImgEl);
    updateAmbientLighting(this.coverImgEl);

    // 渲染曲目列表
    this.tracksData = data.tracks || [];
    this.trackListEl.innerHTML = '';

    this.tracksData.forEach((track) => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.dataset.trackNum = track.position;

      li.innerHTML = `
        <span class="track-num">${String(track.position).padStart(2, '0')}</span>
        <span class="track-title">${track.title}</span>
        <span class="track-duration text-right">${track.duration || '03:30'}</span>
      `;

      li.addEventListener('click', () => {
        if (this.onTrackClick) {
          this.onTrackClick(track.position);
        }
      });

      this.trackListEl.appendChild(li);
    });

    this.setActiveTrack(1);
  }

  setActiveTrack(trackNumber) {
    this.currentTrackIndex = trackNumber;
    const items = this.trackListEl.querySelectorAll('.track-item');
    
    items.forEach(item => {
      if (parseInt(item.dataset.trackNum) === trackNumber) {
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  updateProgress(currentTimeSec, durationSec, percent) {
    this.currentTimeEl.textContent = this.formatTime(currentTimeSec);
    this.totalDurationEl.textContent = this.formatTime(durationSec);
    this.progressFillEl.style.width = `${Math.min(100, percent)}%`;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
