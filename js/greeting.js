const greetings = [
  { text: "Glad you’re here", color: "text-blue-600 dark:text-blue-400" },
  { text: "नमस्ते", color: "text-orange-600 dark:text-orange-400" },
  { text: "Hola", color: "text-emerald-600 dark:text-emerald-400" },
  { text: "Bonjour", color: "text-purple-600 dark:text-purple-400" },
  { text: "Ciao", color: "text-rose-600 dark:text-rose-400" }
];

let i = 0;
const el = document.getElementById("greeting-text");

setInterval(() => {
  el.classList.add("opacity-0");
  setTimeout(() => {
    i = (i + 1) % greetings.length;
    el.className = "ml-2 transition-all duration-500 " + greetings[i].color;
    el.textContent = greetings[i].text;
    el.classList.remove("opacity-0");
  }, 300);
}, 2000);
