// src/utils/terrain.js
export async function sampleElevation(lng, lat, zoom = 12, apiKey) {
    // 1) перевести lon/lat → x,y тайла
    const tileCount = 2 ** zoom;
    const x = ((lng + 180) / 360) * tileCount;
    const y =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
            1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
      tileCount;
    const tileX = Math.floor(x),
          tileY = Math.floor(y);
    const px = Math.floor((x - tileX) * 256),
          py = Math.floor((y - tileY) * 256);
  
    // 2) скачать PNG-тайл
    const url = `https://api.maptiler.com/tiles/terrain-rgb-v2/${zoom}/${tileX}/${tileY}.webp?key=${apiKey}`;
    const resp = await fetch(url);
    const blob = await resp.blob();
    // 3) раскодировать в ImageBitmap, скопировать пиксель [px,py]
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(256,256);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap,0,0);
    const { data } = ctx.getImageData(px,py,1,1);
    const [R,G,B] = data;
    return -10000 + (R*256*256 + G*256 + B)*0.1;  // метры
  }
  