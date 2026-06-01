const html = document.documentElement;
const btn = document.getElementById("theme-toggle");

function setTheme(theme) {
    if (theme === "dark") {
        html.classList.add("dark");
    } else {
        html.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);

    document.getElementById("sun-icon")?.classList.toggle("hidden", theme === "dark");
    document.getElementById("moon-icon")?.classList.toggle("hidden", theme !== "dark");
}

const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");

setTheme(savedTheme);

btn?.addEventListener("click", () => {
    setTheme(html.classList.contains("dark") ? "light" : "dark");
});