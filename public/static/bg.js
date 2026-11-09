
document.addEventListener('DOMContentLoaded', () => {
    const gridSize = 80;
    const numSquares = 30;
    const words = ["UPLOAD", "DATA", "SECURE", "LINK", "SYNC", "CLOUD", "P2P", "NODE", "HASH", "FILE"];

    // --- Theme Logic ---
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;



    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-theme', savedTheme);


    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);


            // Re-create squares to use theme colors
            createSquares();
        });
    }

    // --- Background Logic ---
    let bgContainer = document.getElementById('tech-bg');
    if (!bgContainer) {
        bgContainer = document.createElement('div');
        bgContainer.id = 'tech-bg';
        document.body.prepend(bgContainer);
    }

    function createSquares() {
        bgContainer.innerHTML = '';
        const cols = Math.ceil(window.innerWidth / gridSize);
        const rows = Math.ceil(window.innerHeight / gridSize);
        const isDark = htmlElement.getAttribute('data-theme') === 'dark';

        for (let i = 0; i < numSquares; i++) {
            const div = document.createElement('div');
            div.classList.add('tech-square');

            if (Math.random() > 0.5) {
                div.classList.add('primary');
            } else {
                div.classList.add('dark');
            }

            if (Math.random() > 0.6) {
                const word = words[Math.floor(Math.random() * words.length)];
                div.textContent = word;
                div.classList.add('with-text');
            }

            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);

            div.style.top = (r * gridSize) + 'px';
            div.style.left = (c * gridSize) + 'px';

            bgContainer.appendChild(div);
        }
    }

    createSquares();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(createSquares, 250);
    });
});
