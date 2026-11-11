import { subscribeSession } from './session.js';
import { api, $, element, notice, perform } from './api.js';

const card = $('studentSectionMembership');
const form = $('joinSectionForm');
let active = false;

function renderSections(sections) {
    const list = $('mySectionsList');
    list.replaceChildren();
    for (const section of sections) list.append(element('li', section.name));
    $('mySectionsEmpty').hidden = sections.length > 0;
}

async function loadSections() {
    const result = await api('my-sections');
    renderSections(result.sections || []);
}

subscribeSession(next => {
    active = next.status === 'ready' && !!next.user && next.role === 'player';
    card.hidden = !active;
    if (active) loadSections().catch(error => notice($('joinSectionNotice'), error.message, true));
});

form.addEventListener('submit', event => {
    event.preventDefault();
    const button = event.submitter;
    perform(button, $('joinSectionNotice'), async () => {
        const code = new FormData(form).get('code');
        const result = await api('join-section', { method: 'POST', body: { code } });
        form.reset();
        await loadSections();
        notice($('joinSectionNotice'), `You joined ${result.section.name}.`);
    });
});
