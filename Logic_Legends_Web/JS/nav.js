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

function toggleMenu() {
    if(!hamburgerBtn || !mobileMenu) return; // Safety check
    
    hamburgerBtn.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    if (mobileMenu.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleMenu);
}

// Close menu when a link is clicked
mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
        if(mobileMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
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

