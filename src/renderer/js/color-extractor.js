/**
 * 从专辑封面提取主色调并作用于背景氛围灯
 */
function updateAmbientLighting(imgElement) {
  const ambientEl = document.getElementById('ambient-light');
  if (!ambientEl || !imgElement) return;

  // 如果没有真实图片或图片加载失败，应用复古暗金默认光晕
  const defaultGlow = 'radial-gradient(circle at 30% 40%, rgba(220, 168, 84, 0.18) 0%, transparent 60%)';

  if (!imgElement.complete || imgElement.naturalWidth === 0) {
    ambientEl.style.background = defaultGlow;
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 40;
    canvas.height = 40;

    ctx.drawImage(imgElement, 0, 0, 40, 40);
    const data = ctx.getImageData(0, 0, 40, 40).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 16) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    // 设置极具沉浸感的柔和气泡光晕
    ambientEl.style.background = `radial-gradient(circle at 30% 40%, rgba(${r}, ${g}, ${b}, 0.28) 0%, transparent 65%)`;
  } catch (e) {
    // 跨域或安全限制回退
    ambientEl.style.background = defaultGlow;
  }
}
