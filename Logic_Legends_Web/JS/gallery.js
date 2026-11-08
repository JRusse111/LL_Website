(() => {
    const gallery = document.querySelector('.game-gallery');
    if (!gallery) return;

    const slides = [...gallery.querySelectorAll('.gallery-slide')];
    if (slides.length < 2) return;

    const dotsContainer = gallery.querySelector('.gallery-dots');
    const count = gallery.querySelector('.gallery-count');
    const status = gallery.querySelector('[data-gallery-status]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let paused = reducedMotion.matches;
    let hovering = false;
    let focused = false;
    let inView = false;
    let timer;

    const dots = slides.map((slide, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gallery-dot';
        button.setAttribute('aria-label', `Show image ${index + 1}: ${slide.querySelector('h3').textContent}`);
        button.setAttribute('aria-controls', 'gallery-slides');
        button.addEventListener('click', () => navigate(index));
        dotsContainer.append(button);
        return button;
    });

    function show(index, announce = true) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => { slide.hidden = i !== current; });
        dots.forEach((dot, i) => {
            if (i === current) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
        });
        count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
        if (announce) {
            status.textContent = `Image ${current + 1} of ${slides.length}. ${slides[current].querySelector('.gallery-location').textContent}. ${slides[current].querySelector('h3').textContent}. ${slides[current].querySelector('figcaption p').textContent}`;
        }
    }

    function schedule() {
        window.clearTimeout(timer);
        if (paused || hovering || focused || !inView || document.hidden) return;
        timer = window.setTimeout(() => {
            show(current + 1, false);
            schedule();
        }, 6000);
    }

    function navigate(index) {
        show(index);
        schedule();
    }

    gallery.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    gallery.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    gallery.addEventListener('focusin', () => { focused = true; schedule(); });
    gallery.addEventListener('focusout', event => {
        focused = gallery.contains(event.relatedTarget);
        schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', event => {
        paused = event.matches;
        schedule();
    });
    const observer = new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        schedule();
    }, { threshold: 0.25 });
    observer.observe(gallery.querySelector('.gallery-stage'));

    gallery.querySelector('[data-gallery-previous]').addEventListener('click', () => navigate(current - 1));
    gallery.querySelector('[data-gallery-next]').addEventListener('click', () => navigate(current + 1));
    gallery.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            navigate(current + (event.key === 'ArrowRight' ? 1 : -1));
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            navigate(event.key === 'Home' ? 0 : slides.length - 1);
        }
    });

    let touchStart = null;
    const stage = gallery.querySelector('.gallery-stage');
    stage.addEventListener('touchstart', event => {
        touchStart = event.touches.length === 1
            ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    stage.addEventListener('touchend', event => {
        if (!touchStart || event.changedTouches.length !== 1) return;
        const dx = event.changedTouches[0].clientX - touchStart.x;
        const dy = event.changedTouches[0].clientY - touchStart.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(current + (dx < 0 ? 1 : -1));
        touchStart = null;
    }, { passive: true });
    stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

    show(0, false);
    gallery.querySelector('.gallery-arrows').hidden = false;
    gallery.querySelector('.gallery-navigation').hidden = false;
    gallery.classList.add('gallery-ready');
    schedule();
})();
