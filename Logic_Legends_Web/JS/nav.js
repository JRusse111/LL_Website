// --- 1. Sticky Navigation Bar & Smooth Scrolling ---
const header = document.getElementById('site-header');

window.addEventListener('scroll', () => {
    // 10px threshold works best for all pages
    if (window.scrollY > 10) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// --- 2. Mobile Hamburger Menu ---
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileLinks = document.querySelectorAll('.mobile-link');

function setMobileMenu(open, restoreFocus = false) {
    if (!hamburgerBtn || !mobileMenu) return;
    hamburgerBtn.classList.toggle('active', open);
    mobileMenu.classList.toggle('active', open);
    hamburgerBtn.setAttribute('aria-expanded', String(open));
    hamburgerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileMenu.inert = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) mobileMenu.querySelector('a[href]')?.focus();
    else if (restoreFocus) hamburgerBtn.focus();
}

hamburgerBtn?.addEventListener('click', () => setMobileMenu(!mobileMenu?.classList.contains('active')));
mobileLinks.forEach(link => link.addEventListener('click', () => setMobileMenu(false)));
document.querySelector('#site-header .logo')?.addEventListener('click', () => setMobileMenu(false));
matchMedia('(min-width: 1200px)').addEventListener('change', event => { if (event.matches) setMobileMenu(false); });
document.addEventListener('keydown', event => {
    if (!mobileMenu?.classList.contains('active')) return;
    if (event.key === 'Escape') { setMobileMenu(false, true); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...document.querySelectorAll('#site-header .logo,#site-header [data-login-link]'), hamburgerBtn, ...mobileMenu.querySelectorAll('a[href],button:not(:disabled)')].filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

// --- 3. Password Visibility Toggle (Global) ---
const togglePasswordBtn = document.getElementById('togglePassword');
const passInput = document.getElementById('passwordInput') || document.getElementById('signupPasswordInput');

// Safety check: Only run this code if the page actually has a password input
if (togglePasswordBtn && passInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passInput.getAttribute('type') === 'password';
        passInput.setAttribute('type', isPassword ? 'text' : 'password');
        togglePasswordBtn.setAttribute('aria-pressed', String(isPassword));
        togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        const icon = togglePasswordBtn.querySelector('.bx');
        if (icon) {
            icon.classList.toggle('bx-show', !isPassword);
            icon.classList.toggle('bx-hide', isPassword);
        }
    });
}

