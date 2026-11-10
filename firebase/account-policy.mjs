export const NCST_DOMAIN = 'ncst.edu.ph';
export function normalizeEmail(value) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@ncst\.edu\.ph$/.test(email)) {
        throw Object.assign(new Error('Use your @ncst.edu.ph email address.'), { status: 400 });
    }
    return email;
}
export function nameParts(value = {}) {
    const clean = x => typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    return { surname: clean(value.surname), firstName: clean(value.firstName), middleName: clean(value.middleName) };
}
export function formatName(value = {}, fallback = '') {
    const n = nameParts(value);
    if (n.surname && n.firstName) return `${n.surname}, ${n.firstName}${n.middleName ? ` ${[...n.middleName][0].toUpperCase()}.` : ''}`;
    return fallback || 'Name not provided';
}
export const TRIALS = Object.freeze([
    'Propositional Logic', 'Truth Table', 'Rules of Inference', 'Formal vs Informal Proofs',
    'Direct and Indirect Proofs', 'Mathematical Induction', 'Sets', 'Functions & Relations', 'Graphs', 'Trees'
].map((title, i) => Object.freeze({ number: i + 1, title })));
