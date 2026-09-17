import { renderShell } from '../shared/shell.js';

// Static for v1 — there's no property_info table in the schema, so nothing
// here is admin-editable yet. If the client wants this editable per
// district/property later, that's a new table + admin screen.
export function renderInfo(root) {
	const content = renderShell(root, { activeHref: '#/tenant/info', title: 'Information' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Information</h2>
		</div>
		<div class="card">
			<b class="small">Building rules</b>
			<ul class="small muted" style="margin:8px 0 0; padding-left:18px; line-height:1.8;">
				<li>Quiet hours are 22:00–06:00, every day.</li>
				<li>No structural changes or painting without written permission.</li>
				<li>Refuse goes out the night before collection, in sealed bags.</li>
				<li>Common areas must be kept clear of personal items.</li>
				<li>Pets are only allowed where your lease specifically permits them.</li>
			</ul>
		</div>
		<div class="card">
			<b class="small">Utilities</b>
			<p class="small muted" style="margin:8px 0 0;">
				Water is metered per unit and billed with rent. Electricity is prepaid —
				load tokens using your meter number. If a meter looks faulty, log a
				maintenance request rather than adjusting it yourself.
			</p>
		</div>
		<div class="card">
			<b class="small">Leaving the property</b>
			<p class="small muted" style="margin:8px 0 0;">
				Two calendar months' written notice is required before moving out. A joint
				inspection is done before keys are handed back, and your deposit is
				refunded after that, less any damage beyond fair wear and tear.
			</p>
		</div>
		<div class="card">
			<b class="small">Contacts</b>
			<p class="small muted" style="margin:8px 0 0;">
				For anything non-urgent, use <a href="#/tenant/messages">Messages</a> so there's
				a written record. For a genuine emergency, use the SOS button at the top of
				the screen.
			</p>
		</div>
	`;
}