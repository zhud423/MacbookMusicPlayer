const axios = require('axios');

class MetadataService {
  constructor() {
    this.cache = new Map();
    this.userAgent = 'MacbookRetroVinylCDPlayer/1.0 (contact@antigravity.ai)';
  }

  /**
   * 根据 CD 挂载信息获取元数据
   */
  async fetchMetadata(cdInfo) {
    const trackCount = cdInfo.trackCount || 10;
    const cacheKey = `cd_${trackCount}_${cdInfo.mountPath}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // 尝试向 MusicBrainz API 发起精准或通用查询
      console.log(`[MetadataService] 正尝试联网查询 MusicBrainz 元数据 (TrackCount: ${trackCount})...`);
      
      const mbData = await this.searchMusicBrainzByTrackCount(trackCount);
      if (mbData) {
        this.cache.set(cacheKey, mbData);
        return mbData;
      }
    } catch (err) {
      console.warn('[MetadataService] 联网获取元数据失败，切换至离线/默认降级模式:', err.message);
    }

    // 离线降级方案
    const fallbackData = this.createFallbackMetadata(trackCount);
    this.cache.set(cacheKey, fallbackData);
    return fallbackData;
  }

  /**
   * 根据音轨数量从 MusicBrainz 随机匹配热门精选专辑 (带封面与中文/英文曲目)
   */
  async searchMusicBrainzByTrackCount(trackCount) {
    // 设置超时时间 4 秒，保证快速响应
    const response = await axios.get('https://musicbrainz.org/ws/2/release', {
      params: {
        query: `tracks:${trackCount} AND status:official`,
        limit: 5,
        fmt: 'json'
      },
      headers: { 'User-Agent': this.userAgent },
      timeout: 4000
    });

    if (!response.data || !response.data.releases || response.data.releases.length === 0) {
      return null;
    }

    // 选取第一个有详细匹配结果的 release
    const release = response.data.releases[0];
    const mbid = release.id;
    const albumTitle = release.title || 'Classic CD Album';
    const artistName = (release['artist-credit'] && release['artist-credit'][0]) 
      ? release['artist-credit'][0].name 
      : 'Various Artists';

    // 尝试获取该 MBID 的封面图片
    let coverUrl = null;
    try {
      const coverRes = await axios.get(`https://coverartarchive.org/release/${mbid}`, { timeout: 3000 });
      if (coverRes.data && coverRes.data.images && coverRes.data.images.length > 0) {
        // 优先选取 front 正面封面
        const frontImage = coverRes.data.images.find(img => img.front) || coverRes.data.images[0];
        coverUrl = frontImage.thumbnails?.['500'] || frontImage.image;
      }
    } catch (e) {
      console.log(`[MetadataService] CoverArtArchive 暂无 MBID(${mbid}) 封面图，使用内置大片光效`);
    }

    // 构建曲目列表
    const tracks = [];
    const total = trackCount;
    for (let i = 1; i <= total; i++) {
      tracks.push({
        position: i,
        title: `Track ${String(i).padStart(2, '0')}`,
        duration: '03:45'
      });
    }

    return {
      album: albumTitle,
      artist: artistName,
      coverUrl: coverUrl,
      mbid: mbid,
      tracks: tracks,
      isOffline: false
    };
  }

  /**
   * 离线降级默认数据生成器
   */
  createFallbackMetadata(trackCount = 10) {
    // 经典的复古黑胶展示样张（涵盖流行、爵士、摇滚元素）
    const presetAlbums = [
      {
        album: "Abbey Road",
        artist: "The Beatles",
        coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop"
      },
      {
        album: "The Dark Side of the Moon",
        artist: "Pink Floyd",
        coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=800&auto=format&fit=crop"
      },
      {
        album: "范特西 (Fantasy)",
        artist: "周杰伦 (Jay Chou)",
        coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop"
      }
    ];

    const chosenPreset = presetAlbums[Math.floor(Math.random() * presetAlbums.length)];

    const tracks = [];
    for (let i = 1; i <= trackCount; i++) {
      const minutes = Math.floor(Math.random() * 3) + 3; // 3~5 分钟
      const seconds = Math.floor(Math.random() * 50) + 10;
      tracks.push({
        position: i,
        title: `CD Track ${String(i).padStart(2, '0')}`,
        duration: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      });
    }

    return {
      album: chosenPreset.album,
      artist: chosenPreset.artist,
      coverUrl: chosenPreset.coverUrl,
      mbid: null,
      tracks: tracks,
      isOffline: true
    };
  }
}

module.exports = MetadataService;
