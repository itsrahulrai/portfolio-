/* ==========================================================================
   GitHub Activity Widget — premium dashboard
   - Contribution heatmap:  github-contributions-api.jogruber.de (unauth, CORS-open)
   - Profile + repos:       api.github.com REST (unauth, 60 req/hr per IP)
   No API keys required. Every block fails gracefully on its own.
   ========================================================================== */

(function () {
    const GH_USERNAME = "itsrahulrai";

    const LANG_COLORS = {
        JavaScript: "#f1e05a",
        TypeScript: "#3178c6",
        PHP: "#4F5D95",
        HTML: "#e34c26",
        CSS: "#563d7c",
        Python: "#3572A5",
        Java: "#b07219",
        "C++": "#f34b7d",
        Blade: "#f7523f",
        Vue: "#41b883",
        Shell: "#89e051",
        EJS: "#a91e50",
        default: "#94a3b8",
    };

    let reposCache = null;
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour — real data, just avoids re-hitting GitHub's 60/hr limit on repeat views

    function cacheGet(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function cacheSet(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
        } catch (e) {
            /* storage unavailable (private mode etc.) — fine, just skip caching */
        }
    }

    async function fetchJSON(url, retries = 1) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            return await res.json();
        } catch (e) {
            if (retries > 0) {
                await new Promise((r) => setTimeout(r, 700));
                return fetchJSON(url, retries - 1);
            }
            throw e;
        }
    }

    // Stale-while-revalidate: serve cached real data instantly if fresh,
    // otherwise fetch live; if the live fetch fails, fall back to stale
    // cache rather than showing nothing. Always real GitHub data, never
    // placeholder/dummy numbers.
    async function fetchWithCache(cacheKey, url) {
        const cached = cacheGet(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            return cached.data;
        }
        try {
            const data = await fetchJSON(url);
            cacheSet(cacheKey, data);
            return data;
        } catch (e) {
            if (cached) return cached.data;
            throw e;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const root = document.getElementById("github-activity");
        if (!root) return;
        initProfile();
        initHeatmapAndStats();
        getRepos().then((repos) => {
            initLanguages(repos);
            initFeaturedRepos(repos);
        });
    });

    /* ---------------- Shared repo fetch (cached, used by 2 widgets) ---------------- */
    async function getRepos() {
        if (reposCache) return reposCache;
        try {
            const repos = await fetchWithCache(
                `gh_repos_${GH_USERNAME}`,
                `https://api.github.com/users/${GH_USERNAME}/repos?per_page=100&type=owner`
            );
            reposCache = Array.isArray(repos) ? repos.filter((r) => !r.fork) : [];
            return reposCache;
        } catch (e) {
            reposCache = [];
            return reposCache;
        }
    }

    /* ---------------- Profile summary ---------------- */
    async function initProfile() {
        const el = document.getElementById("gh-profile");
        try {
            const data = await fetchWithCache(
                `gh_profile_${GH_USERNAME}`,
                `https://api.github.com/users/${GH_USERNAME}`
            );
            el.innerHTML = `
                <img class="gh-avatar" src="${data.avatar_url}" alt="${GH_USERNAME} GitHub avatar" loading="lazy">
                <div class="flex flex-wrap gap-2">
                    <span class="gh-stat-pill"><strong>${data.public_repos}</strong> repos</span>
                    <span class="gh-stat-pill"><strong>${data.followers}</strong> followers</span>
                    <a href="https://github.com/${GH_USERNAME}" target="_blank" rel="noopener" class="gh-stat-pill" style="text-decoration:none;">
                        <i class="fab fa-github"></i> Profile
                    </a>
                </div>
            `;
        } catch (e) {
            el.innerHTML = `
                <div class="gh-avatar"></div>
                <a href="https://github.com/${GH_USERNAME}" target="_blank" rel="noopener" class="gh-stat-pill" style="text-decoration:none;">@${GH_USERNAME}</a>
            `;
        }
    }

    /* ---------------- Contribution heatmap + streaks + stat tiles ---------------- */
    async function initHeatmapAndStats() {
        const wrap = document.getElementById("gh-heatmap-wrap");
        const tilesWrap = document.getElementById("gh-stat-tiles");
        const yearRangeEl = document.getElementById("gh-year-range");

        try {
            const data = await fetchWithCache(
                `gh_contrib_${GH_USERNAME}`,
                `https://github-contributions-api.jogruber.de/v4/${GH_USERNAME}?y=last`
            );
            const days = data.contributions || [];
            if (!days.length) throw new Error("no data");

            renderHeatmap(wrap, days);
            const streaks = computeStreaks(days);
            if (yearRangeEl) {
                const first = new Date(days[0].date);
                const last = new Date(days[days.length - 1].date);
                yearRangeEl.textContent = `${first.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${last.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
            }
            renderStatTiles(tilesWrap, streaks);
        } catch (e) {
            wrap.innerHTML = fallbackMarkup("Live contribution graph is temporarily unavailable.");
            renderStatTiles(tilesWrap, null);
        }
    }

    function renderHeatmap(container, days) {
        const cell = 11;
        const gap = 3;
        const step = cell + gap;
        const topPad = 16;
        const leftPad = 20;

        const byDate = {};
        days.forEach((d) => (byDate[d.date] = d));

        const today = new Date(days[days.length - 1].date);
        const end = new Date(today);
        const start = new Date(end);
        start.setDate(start.getDate() - 370);
        start.setDate(start.getDate() - start.getDay());

        const weeks = [];
        let cursor = new Date(start);
        while (cursor <= end) {
            const week = [];
            for (let i = 0; i < 7; i++) {
                const key = cursor.toISOString().slice(0, 10);
                week.push(byDate[key] || { date: key, count: 0, level: 0 });
                cursor.setDate(cursor.getDate() + 1);
            }
            weeks.push(week);
        }

        const width = leftPad + weeks.length * step + 4;
        const height = topPad + 7 * step;

        let monthLabels = "";
        let lastMonth = -1;
        weeks.forEach((week, wi) => {
            const d = new Date(week[0].date);
            const m = d.getMonth();
            if (m !== lastMonth) {
                monthLabels += `<text class="gh-month-label" x="${leftPad + wi * step}" y="10">${d.toLocaleString("en-US", { month: "short" })}</text>`;
                lastMonth = m;
            }
        });

        const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]
            .map((l, i) => (l ? `<text class="gh-day-label" x="0" y="${topPad + i * step + 9}">${l}</text>` : ""))
            .join("");

        let cells = "";
        let idx = 0;
        weeks.forEach((week, wi) => {
            week.forEach((d, di) => {
                const x = leftPad + wi * step;
                const y = topPad + di * step;
                const level = Math.min(d.level ?? 0, 4);
                const delay = (idx * 1.1).toFixed(1);
                cells += `<rect class="gh-cell gh-level-${level}" style="animation-delay:${delay}ms" width="${cell}" height="${cell}" x="${x}" y="${y}" rx="2.5" data-date="${d.date}" data-count="${d.count}"></rect>`;
                idx++;
            });
        });

        container.innerHTML = `
            <div class="gh-heatmap-scroll">
                <svg viewBox="0 0 ${width} ${height}" style="min-width:${Math.max(width, 780)}px; height:${height}px;">
                    ${monthLabels}
                    ${dayLabels}
                    ${cells}
                </svg>
            </div>
            <div class="flex items-center justify-between mt-2 flex-wrap gap-2">
                <span class="gh-legend">Less
                    <span class="gh-legend-swatch gh-level-0"></span>
                    <span class="gh-legend-swatch gh-level-1"></span>
                    <span class="gh-legend-swatch gh-level-2"></span>
                    <span class="gh-legend-swatch gh-level-3"></span>
                    <span class="gh-legend-swatch gh-level-4"></span>
                    More
                </span>
                <a href="https://github.com/${GH_USERNAME}" target="_blank" rel="noopener"
                   class="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold">
                   View full profile &rarr;
                </a>
            </div>
        `;

        attachTooltip(container);
    }

    function attachTooltip(container) {
        let tip = document.getElementById("gh-tooltip");
        if (!tip) {
            tip = document.createElement("div");
            tip.id = "gh-tooltip";
            tip.className = "gh-tooltip";
            document.body.appendChild(tip);
        }
        container.querySelectorAll(".gh-cell").forEach((rect) => {
            rect.addEventListener("mouseenter", (e) => {
                const { date, count } = e.target.dataset;
                const nice = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                });
                tip.textContent = `${count} contribution${count == 1 ? "" : "s"} on ${nice}`;
                tip.classList.add("visible");
            });
            rect.addEventListener("mousemove", (e) => {
                tip.style.left = e.clientX + "px";
                tip.style.top = e.clientY - 12 + "px";
            });
            rect.addEventListener("mouseleave", () => tip.classList.remove("visible"));
        });
    }

    function computeStreaks(days) {
        const total = days.reduce((sum, d) => sum + (d.count || 0), 0);

        let longest = 0, running = 0;
        days.forEach((d) => {
            if (d.count > 0) {
                running++;
                longest = Math.max(longest, running);
            } else {
                running = 0;
            }
        });

        let current = 0;
        for (let i = days.length - 1; i >= 0; i--) {
            if (days[i].count > 0) current++;
            else break;
        }

        const activeDays = days.filter((d) => d.count > 0).length;
        const consistency = Math.round((activeDays / days.length) * 100);

        return { total, current, longest, consistency };
    }

    function renderStatTiles(container, streaks) {
        const tiles = [
            { icon: "fa-code-commit", value: streaks ? streaks.total : "—", label: "Contributions / yr" },
            { icon: "fa-fire", value: streaks ? streaks.current : "—", suffix: streaks ? "d" : "", label: "Current Streak" },
            { icon: "fa-bolt", value: streaks ? streaks.longest : "—", suffix: streaks ? "d" : "", label: "Longest Streak" },
            { icon: "fa-calendar-check", value: streaks ? streaks.consistency : "—", suffix: streaks ? "%" : "", label: "Active Day Rate" },
        ];

        container.innerHTML = tiles
            .map(
                (t) => `
                <div class="gh-tile tilt-card gh-fade-in">
                    <i class="fas ${t.icon} gh-tile-icon"></i>
                    <div class="gh-tile-value">${typeof t.value === "number" ? `<span data-count="${t.value}">0</span>${t.suffix || ""}` : t.value}</div>
                    <div class="gh-tile-label">${t.label}</div>
                </div>
            `
            )
            .join("");

        animateCounters(container);
    }

    function animateCounters(scope) {
        const els = scope.querySelectorAll("[data-count]");
        els.forEach((el) => {
            const target = parseInt(el.dataset.count, 10) || 0;
            const suffixEl = el.querySelector("span");
            const suffixHtml = suffixEl ? suffixEl.outerHTML : "";
            const duration = 900;
            const startTime = performance.now();

            function tick(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(target * eased);
                el.innerHTML = current + suffixHtml;
                if (progress < 1) requestAnimationFrame(tick);
                else el.innerHTML = target + suffixHtml;
            }
            requestAnimationFrame(tick);
        });
    }

    /* ---------------- Language composition (byte-weighted where possible) ---------------- */
    async function initLanguages(repos) {
        const el = document.getElementById("gh-languages");
        try {
            if (!repos.length) throw new Error("no repos");

            // Byte-accurate stats from the 10 most recently active repos
            const sample = [...repos]
                .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
                .slice(0, 10);

            const results = await Promise.allSettled(
                sample.map((r) =>
                    fetchWithCache(`gh_lang_${r.full_name}`, r.languages_url).catch(() => ({}))
                )
            );

            const totals = {};
            let anySuccess = false;
            results.forEach((r) => {
                if (r.status === "fulfilled" && r.value && typeof r.value === "object") {
                    anySuccess = true;
                    Object.entries(r.value).forEach(([lang, bytes]) => {
                        totals[lang] = (totals[lang] || 0) + bytes;
                    });
                }
            });

            let entries;
            if (anySuccess && Object.keys(totals).length) {
                const grand = Object.values(totals).reduce((s, v) => s + v, 0);
                entries = Object.entries(totals)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([lang, bytes]) => [lang, Math.round((bytes / grand) * 100)]);
            } else {
                const counts = {};
                repos.filter((r) => r.language).forEach((r) => (counts[r.language] = (counts[r.language] || 0) + 1));
                const grand = Object.values(counts).reduce((s, v) => s + v, 0);
                entries = Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([lang, c]) => [lang, Math.round((c / grand) * 100)]);
            }

            if (!entries.length) throw new Error("no languages");

            el.innerHTML = entries
                .map(([lang, pct]) => {
                    const color = LANG_COLORS[lang] || LANG_COLORS.default;
                    return `
                        <div class="gh-lang-row">
                            <span class="gh-lang-name"><span class="gh-lang-dot" style="background:${color}"></span>${lang}</span>
                            <span class="gh-lang-track"><span class="gh-lang-fill" style="width:0%; background:${color};" data-pct="${pct}"></span></span>
                            <span class="gh-lang-pct">${pct}%</span>
                        </div>
                    `;
                })
                .join("");

            requestAnimationFrame(() => {
                el.querySelectorAll(".gh-lang-fill").forEach((bar) => {
                    bar.style.width = bar.dataset.pct + "%";
                });
            });
        } catch (e) {
            el.innerHTML = fallbackMarkup("Language stats are temporarily unavailable.");
        }
    }

    /* ---------------- Featured repositories ---------------- */
    async function initFeaturedRepos(repos) {
        const el = document.getElementById("gh-repos");
        try {
            if (!repos.length) throw new Error("no repos");

            const top = [...repos]
                .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
                .slice(0, 4);

            el.innerHTML = top
                .map((r) => {
                    const color = LANG_COLORS[r.language] || LANG_COLORS.default;
                    return `
                        <a href="${r.html_url}" target="_blank" rel="noopener" class="gh-repo tilt-card">
                            <div class="gh-repo-top">
                                <span class="gh-repo-name"><i class="fas fa-code-branch"></i><span>${r.name}</span></span>
                                <span class="gh-repo-meta">
                                    ${r.stargazers_count ? `<span><i class="fas fa-star" style="color:#f59e0b;"></i> ${r.stargazers_count}</span>` : ""}
                                    ${r.forks_count ? `<span><i class="fas fa-code-branch"></i> ${r.forks_count}</span>` : ""}
                                    ${r.language ? `<span><span class="gh-lang-dot" style="background:${color};display:inline-block;"></span> ${r.language}</span>` : ""}
                                </span>
                            </div>
                            ${r.description ? `<div class="gh-repo-desc">${escapeHtml(r.description)}</div>` : ""}
                        </a>
                    `;
                })
                .join("");
        } catch (e) {
            el.innerHTML = fallbackMarkup("Repository list is temporarily unavailable.");
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function fallbackMarkup(msg) {
        return `
            <div class="gh-error">
                ${msg}<br>
                <a href="https://github.com/${GH_USERNAME}" target="_blank" rel="noopener"
                   class="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                   View on GitHub &rarr;
                </a>
            </div>
        `;
    }
})();
