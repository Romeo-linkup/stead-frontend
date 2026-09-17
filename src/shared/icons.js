const ICONS = {
	menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
	bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
	siren: '<path d="M12 2a7 7 0 0 0-7 7v6h14V9a7 7 0 0 0-7-7z"/><path d="M12 2v2"/><path d="M2 22h20"/><path d="M5 15v7"/><path d="M19 15v7"/>',
	home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
	wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h3"/><path d="M3 9h18"/>',
	wrench: '<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L21 6l-3-3z"/>',
	document: '<path d="M7 2h7l5 5v15H7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
	message: '<path d="M4 4h16v12H8l-4 4z"/>',
	bullhorn: '<path d="M3 9v6l5 1 9 4V4L8 8l-5 1z"/><path d="M17 8v8"/><path d="M8 16v3a2 2 0 0 0 2 2h1"/>',
	info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7v.5"/>',
	profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
	gauge: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12 16 8"/>',
	building: '<rect x="4" y="3" width="16" height="18"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
	users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 8.2a3 3 0 1 1 3.4 3"/><path d="M16.5 14.3A6.5 6.5 0 0 1 21.5 20"/>',
	key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3"/><path d="M17 6l2 2"/><path d="M14 9l2 2"/>',
	list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
	logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
	plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
};

export function icon(name) {
	return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
