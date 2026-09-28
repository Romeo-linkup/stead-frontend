// src/shared/toast.js — single transient message, mirrors the mockup's toast().
let hideTimer = null;

function ensureToast() {
	let el = document.getElementById('toast');
	if (!el) {
		el = document.createElement('div');
		el.id = 'toast';
		el.className = 'toast';
		document.body.appendChild(el);
	}
	return el;
}

export function toast(msg) {
	const el = ensureToast();
	el.textContent = msg;
	el.classList.add('show');
	clearTimeout(hideTimer);
	hideTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
