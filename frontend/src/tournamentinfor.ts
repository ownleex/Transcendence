import { createTournament, fetchTournaments, joinTournament } from "./api";

export async function renderTournaments(app: HTMLElement) {
    const me = JSON.parse(sessionStorage.getItem("me") || localStorage.getItem("me") || "{}");
    app.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h1 class="text-2xl font-bold text-gray-700 dark:text-gray-200">Tournaments</h1>
            <button id="createTournamentBtn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                Create tournament
            </button>
        </div>
        <div id="tournamentList" class="space-y-3"></div>
        <p id="tournamentMessage" class="text-sm text-gray-500 mt-2"></p>
    `;

    const listEl = document.getElementById("tournamentList")!;
    const msgEl = document.getElementById("tournamentMessage")!;

    async function loadList() {
        listEl.innerHTML = `<div class="text-gray-500">Loading tournaments...</div>`;
        try {
            const res = await fetchTournaments();
            const tournaments = res.tournaments || [];

            if (!tournaments.length) {
                listEl.innerHTML = `<div class="text-gray-500">No tournaments yet.</div>`;
                return;
            }

            listEl.innerHTML = tournaments
                .map(
                    (t: any) => `
                    <div class="p-4 border rounded bg-white dark:bg-gray-800 flex items-center justify-between">
                        <div>
                            <p class="text-xs text-gray-400">ID #${t.tournament_id}</p>
                            <h2 class="font-semibold text-gray-800 dark:text-gray-100">${t.name}</h2>
                            <p class="text-gray-500">Status: <strong>${t.status}</strong> • Players: ${t.player_count}/${t.max_players}</p>
                        </div>
                        <div class="flex gap-2">
                            <button data-open="${t.tournament_id}" class="open-btn px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Open</button>
                            ${
                                t.player_count < 8 && t.status !== "finished"
                                    ? `<button data-join="${t.tournament_id}" class="join-btn px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Join</button>`
                                    : ""
                            }
                        </div>
                    </div>`
                )
                .join("");
        } catch (err: any) {
            listEl.innerHTML = `<p class="text-red-500">${err.message}</p>`;
        }
    }

    listEl.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const joinId = target.getAttribute("data-join");
        const openId = target.getAttribute("data-open");

        if (openId) {
            sessionStorage.setItem("activeTournamentId", openId);
            window.location.hash = "#tournament";
            return;
        }

        if (joinId) {
            if (!me?.id) {
                msgEl.textContent = "You must be logged in to join a tournament.";
                msgEl.className = "text-sm text-red-500";
                return;
            }
            msgEl.textContent = "Joining...";
            msgEl.className = "text-sm text-gray-500";
            try {
                await joinTournament({ tournament_id: Number(joinId), user_id: me.id, nickname: me.username });
                msgEl.textContent = "Joined! Bracket will start when 8 players are in.";
                msgEl.className = "text-sm text-green-600";
                sessionStorage.setItem("activeTournamentId", joinId);
                window.location.hash = "#tournament";
                loadList();
            } catch (err: any) {
                msgEl.textContent = err.message || "Failed to join tournament.";
                msgEl.className = "text-sm text-red-500";
            }
        }
    });

    document.getElementById("createTournamentBtn")?.addEventListener("click", async () => {
        if (!me?.id) {
            msgEl.textContent = "Login required to create a tournament.";
            msgEl.className = "text-sm text-red-500";
            return;
        }
        msgEl.textContent = "Creating tournament...";
        msgEl.className = "text-sm text-gray-500";
        try {
            const name = `Open ${new Date().toLocaleString()}`;
            const res = await createTournament({ name, admin_id: me.id, max_players: 8 });
            sessionStorage.setItem("activeTournamentId", String(res.tournament_id));
            msgEl.textContent = "Tournament created.";
            msgEl.className = "text-sm text-green-600";
            window.location.hash = "#tournament";
            loadList();
        } catch (err: any) {
            msgEl.textContent = err.message || "Failed to create tournament.";
            msgEl.className = "text-sm text-red-500";
        }
    });

    loadList();
}
