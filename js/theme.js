document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");

    if (!btn) return;

    btn.addEventListener("click", () => {
        document.documentElement.classList.toggle("dark");

        if (document.documentElement.classList.contains("dark")) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
    });
});
