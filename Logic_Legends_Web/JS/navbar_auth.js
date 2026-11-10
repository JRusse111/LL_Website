import { subscribeSession, logout } from './session.js';

const menus = [...document.querySelectorAll('[data-user-menu]')];
function setOpen(menu, open) {
    menu.querySelector('[data-account-toggle]').setAttribute('aria-expanded', String(open));
    menu.querySelector('[data-account-dropdown]').hidden = !open;
    if (!open) delete menu.dataset.hoverOpened;
}
menus.forEach(menu => {
    const toggle = menu.querySelector('[data-account-toggle]');
    toggle.addEventListener('click', () => {
        const opening = menu.dataset.hoverOpened === 'true' || toggle.getAttribute('aria-expanded') !== 'true';
        delete menu.dataset.hoverOpened;
        setOpen(menu, opening);
        if (opening) {
            const mobileMenu = document.querySelector('.mobile-menu');
            mobileMenu?.classList.remove('active');
            if (mobileMenu) mobileMenu.inert = true;
            const hamburger = document.getElementById('hamburger-btn');
            hamburger?.classList.remove('active');
            hamburger?.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    });
    menu.addEventListener('mouseenter', () => {
        if (matchMedia('(hover: hover)').matches && toggle.getAttribute('aria-expanded') !== 'true') {
            menu.dataset.hoverOpened = 'true';
            setOpen(menu, true);
        }
    });
    menu.addEventListener('mouseleave', () => { if (!menu.contains(document.activeElement)) setOpen(menu, false); });
    menu.addEventListener('focusout', event => { if (!menu.contains(event.relatedTarget)) setOpen(menu, false); });
    menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { setOpen(menu, false); toggle.focus(); }
        if (event.key === 'ArrowDown' && event.target === toggle) {
            event.preventDefault();
            setOpen(menu, true);
            menu.querySelector('[data-account-dropdown] a').focus();
        }
    });
});
document.addEventListener('click', event => menus.forEach(menu => { if (!menu.contains(event.target)) setOpen(menu, false); }));
document.getElementById('hamburger-btn')?.addEventListener('click', () => menus.forEach(menu => setOpen(menu, false)));

subscribeSession(({ user, role, status }) => {
    const signedIn = !!user;
    document.querySelectorAll('[data-login-link]').forEach(item => { item.hidden = signedIn; });
    document.querySelectorAll('.account-nav').forEach(item => { item.dataset.signedIn = String(signedIn); });
    document.querySelectorAll('[data-mobile-user]').forEach(panel => {
        panel.hidden = !signedIn;
        panel.querySelector('[data-mobile-account-name]').textContent = user?.displayName || user?.email?.split('@')[0] || 'Account';
        panel.querySelector('[data-mobile-account-email]').textContent = user?.email || '';
    });
    document.querySelectorAll('[data-admin-nav]').forEach(item => { item.hidden = role !== 'admin' && role !== 'instructor' && role !== 'super_admin'; });
    document.querySelectorAll('[data-profile-nav]').forEach(item => { item.hidden = role === 'instructor'; });
    menus.forEach(menu => {
        menu.hidden = !signedIn;
        if (!signedIn) { setOpen(menu, false); return; }
        const name = user.displayName || user.email?.split('@')[0] || 'Account';
        menu.querySelectorAll('[data-account-name]').forEach(label => { label.textContent = name; });
        menu.querySelector('[data-menu-name]').textContent = name;
        menu.querySelector('[data-menu-email]').textContent = user.email || '';
        menu.querySelector('[data-account-toggle]').setAttribute('aria-label', `Account menu for ${name}`);
    });
    if (status === 'error') {
        const feedback = document.querySelector('[data-account-feedback]');
        if (feedback) { feedback.textContent = 'Your session could not be verified. Please sign in again.'; feedback.hidden = false; }
    }
    if (user && status === 'ready' && role === 'instructor') {
        const path = location.pathname.toLowerCase();
        const isDashboard = path.includes('/instructordashboard/');
        const isLearnerRecord = path.endsWith('/profile/profile.html') && new URL(location.href).searchParams.has('uid');
        if (!isDashboard && !isLearnerRecord) location.replace(new URL('../InstructorDashboard/i_dashboard.html', import.meta.url).href);
    }
});

document.querySelectorAll('[data-logout]').forEach(button => {
    button.addEventListener('click', async () => {
        button.disabled = true;
        const label = button.textContent;
        button.textContent = 'Logging out…';
        try { await logout(); }
        catch {
            const feedback = document.querySelector('[data-account-feedback]');
            if (feedback) { feedback.textContent = 'Logout failed. Please try again.'; feedback.hidden = false; }
            button.disabled = false;
            button.textContent = label;
        }
    });
});
