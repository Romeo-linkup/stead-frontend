// src/tenant/lease.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderLease(root) {
  const content = renderShell(root, { activeHref: '#/tenant/lease', title: 'Lease' });

  content.innerHTML = `
    <div class="lease-pagehead">
      <h1>My lease</h1>
      <p>Your current residential lease agreement</p>
    </div>
    <div id="lease-container">
      <div class="lease-loading">Loading lease...</div>
    </div>
  `;

  async function loadLease() {
    const container = content.querySelector('#lease-container');

    try {
      const lease = await apiFetch('/leases/mine');

      if (lease.status === 'sent') {
        container.innerHTML = '<div id="lease-document"></div><section class="lease-signature"><h2>Sign this lease</h2><p>Draw your signature below to accept the terms above.</p><canvas id="signature-canvas" aria-label="Signature capture"></canvas><div class="lease-signature-actions"><button id="clear-signature" class="btn secondary" type="button">Clear</button><button id="submit-signature" class="btn brass" type="button">Submit Signature</button></div><div id="signature-error" class="error-text" hidden></div></section>';
        renderLeaseDocument(container, lease);
        setupSignatureCanvas(container, lease);
      } else if (lease.status === 'signed') {
        container.innerHTML = '<div id="lease-document"></div><section class="lease-signature lease-signed"><h2>Signed lease</h2><img id="stored-signature" alt="Stored signature"><p>This lease has been signed and is legally binding.</p></section>';
        renderLeaseDocument(container, lease);
        container.querySelector('#stored-signature').src = lease.signature_image_url;
      } else {
        container.innerHTML = `${lease.status === 'superseded' ? '<p class="small muted">This lease has been replaced by a newer one.</p>' : ''}<div id="lease-document"></div>`;
        renderLeaseDocument(container, lease);
      }
    } catch (err) {
      if (err.message === 'No lease found for your unit.') {
        container.innerHTML = '<div class="lease-message"><h2>No lease yet</h2><p>Your property manager will send your lease here for signature.</p></div>';
        return;
      }
      container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderLeaseDocument(container, lease) {
    container.querySelector('#lease-document').innerHTML = lease.rendered_html;
  }

  function setupSignatureCanvas(container, lease) {
    const canvas = container.querySelector('#signature-canvas');
    const ctx = canvas.getContext('2d');
    const clearBtn = container.querySelector('#clear-signature');
    const submitBtn = container.querySelector('#submit-signature');
    const errorBox = container.querySelector('#signature-error');

    const scale = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Setup drawing
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches && e.touches[0];
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function startDrawing(e) {
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      e.preventDefault();
    }

    function draw(e) {
      if (!isDrawing) return;
      const pos = getPos(e);
      
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#1C2321';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      lastX = pos.x;
      lastY = pos.y;
      e.preventDefault();
    }

    function stopDrawing() {
      isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    submitBtn.addEventListener('click', async () => {
      errorBox.hidden = true;
      const pixelBuffer = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const isBlank = !pixelBuffer.some(channel => channel !== 0);
      
      if (isBlank) {
        errorBox.textContent = 'Please sign before submitting.';
        errorBox.hidden = false;
        return;
      }

      try {
        submitBtn.disabled = true;
        clearBtn.disabled = true;
        const dataUrl = canvas.toDataURL('image/png');
        await apiFetch(`/leases/${lease.id}/sign`, {
          method: 'POST',
          body: { signature_data_url: dataUrl, lease_updated_at: lease.updated_at }
        });
        
        await loadLease();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        if (err.status === 409 || err.message.toLowerCase().includes('changed after you opened it')) {
          setTimeout(() => loadLease(), 2000);
        }
      } finally {
        submitBtn.disabled = false;
        clearBtn.disabled = false;
      }
    });
  }

  await loadLease();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
