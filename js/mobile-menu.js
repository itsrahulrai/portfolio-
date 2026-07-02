document.addEventListener('DOMContentLoaded', function () {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconOpen = document.getElementById('menu-icon-open');
    const iconClose = document.getElementById('menu-icon-close');

    if (!menuBtn || !mobileMenu) return;

    function openMenu() {
        mobileMenu.classList.remove('hidden');
        iconOpen.classList.add('hidden');
        iconClose.classList.remove('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
        mobileMenu.classList.add('hidden');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
    }

    menuBtn.addEventListener('click', function () {
        const isOpen = !mobileMenu.classList.contains('hidden');
        isOpen ? closeMenu() : openMenu();
    });

    // Close the menu whenever a link is tapped
    document.querySelectorAll('.mobile-nav-link').forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    // Close on resize back to desktop width
    window.addEventListener('resize', function () {
        if (window.innerWidth >= 640) closeMenu();
    });
});