export function createSignaturePad(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.touchAction = 'none';
  context.scale(pixelRatio, pixelRatio);

  let drawing = false;
  let lastPoint = null;

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event) {
    drawing = true;
    lastPoint = getPoint(event);
    canvas.setPointerCapture?.(event.pointerId);
    context.fillStyle = '#1C2321';
    context.beginPath();
    context.arc(lastPoint.x, lastPoint.y, 1.2, 0, Math.PI * 2);
    context.fill();
    event.preventDefault();
  }

  function move(event) {
    if (!drawing || !lastPoint) return;
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.strokeStyle = '#1C2321';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
    lastPoint = point;
    event.preventDefault();
  }

  function stop(event) {
    drawing = false;
    lastPoint = null;
    if (event?.pointerId != null && canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', stop);

  function clear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function isBlank() {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return false;
    }
    return true;
  }

  return {
    clear,
    isBlank,
    toDataUrl: () => canvas.toDataURL('image/png'),
  };
}

function hasVisibleInk(canvas) {
  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha > 20 && pixels[index] < 235 && pixels[index + 1] < 235 && pixels[index + 2] < 235) return true;
  }
  return false;
}

function drawImageToCanvas(image, maxWidth, maxHeight) {
  const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read that image.'));
    image.src = url;
  });
}

export async function fileToSignatureDataUrl(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file?.type)) {
    throw new Error('Please choose a PNG or JPG image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('That file is too large (max 5 MB).');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Unable to read that image.');
    }

    let canvas = drawImageToCanvas(image, 800, 300);
    if (!hasVisibleInk(canvas)) {
      throw new Error('That image looks blank. Try a signature on a plain white or transparent background.');
    }

    let dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 1400000) {
      canvas = drawImageToCanvas(image, 500, 190);
      if (!hasVisibleInk(canvas)) {
        throw new Error('That image looks blank. Try a signature on a plain white or transparent background.');
      }
      dataUrl = canvas.toDataURL('image/png');
    }
    if (dataUrl.length > 1400000) throw new Error('That image is too large to use.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
