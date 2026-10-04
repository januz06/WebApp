if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = new URL('../sw.js', window.location.href).href;
        navigator.serviceWorker.register(swUrl).catch(() => {});
    });
}

initStorage();
