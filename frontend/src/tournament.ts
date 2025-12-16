import {
    createTournament,
    fetchTournamentBracket,
    fetchTournaments,
    joinTournament,
    reportTournamentResult,
} from "./api";
import { showGame } from "./pong";

type PlayerLight = {
    id: number;
    user_id?: number;
    displayName?: string;
    name?: string;
    avatar?: string | null;
};
type MatchLight = {
    match_id: number;
    round: "quarter" | "semi" | "final";
    slot: number;
    winner: number | null;
    player1: PlayerLight | null;
    player2: PlayerLight | null;
};

function renderMatchCard(match: MatchLight) {
    const p1Name = match.player1?.displayName || match.player1?.name || "TBD";
    const p2Name = match.player2?.displayName || match.player2?.name || "TBD";
    const p1Avatar = match.player1?.avatar || "/uploads/default.png";
    const p2Avatar = match.player2?.avatar || "/uploads/default.png";
    const p1Win = match.winner && match.player1 && match.winner === match.player1.id;
    const p2Win = match.winner && match.player2 && match.winner === match.player2.id;
    return `
      <div class="p-3 rounded-lg border ${match.winner ? "border-green-400 bg-green-50" : "border-gray-300 bg-white"} shadow-sm">
        <div class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-2 ${p1Win ? "text-green-700 font-semibold" : "text-gray-700"}">
            <img src="${p1Avatar}" class="w-6 h-6 rounded-full object-cover border" />
            ${p1Name}
          </span>
          <span class="text-gray-400">vs</span>
          <span class="flex items-center gap-2 ${p2Win ? "text-green-700 font-semibold" : "text-gray-700"}">
            ${p2Name}
            <img src="${p2Avatar}" class="w-6 h-6 rounded-full object-cover border" />
          </span>
        </div>
        <p class="text-xs text-gray-400 mt-1">Match #${match.match_id}</p>
      </div>
    `;
}

function findNextMatch(rounds: { quarter: MatchLight[]; semi: MatchLight[]; final: MatchLight[] }) {
    const order: Array<keyof typeof rounds> = ["quarter", "semi", "final"];
    for (const round of order) {
        const match = (rounds[round] || []).find((m) => m.player1 && m.player2 && !m.winner);
        if (match) return { match, round };
    }
    return null;
}

export async function showTournament(container: HTMLElement) {
    const me = JSON.parse(sessionStorage.getItem("me") || localStorage.getItem("me") || "{}");
    const storedId = sessionStorage.getItem("activeTournamentId") || localStorage.getItem("activeTournamentId");
    let activeId: number | undefined = storedId ? Number(storedId) : undefined;

    async function loadAndRender() {
        container.innerHTML = `<div class="text-gray-500">Loading tournaments...</div>`;

        try {
            const tournamentsRes = await fetchTournaments();
            const tournaments = tournamentsRes.tournaments || [];
            if (!activeId && tournaments.length) {
                activeId = tournaments[0].tournament_id;
            }

            if (!activeId) {
                container.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <p class="text-gray-700 dark:text-gray-200 mb-4">No tournament available. Create one to start a bracket of 8 players.</p>
                        <button id="createFromBracket" class="px-4 py-2 bg-blue-600 text-white rounded">Create tournament</button>
                    </div>
                `;
                document.getElementById("createFromBracket")?.addEventListener("click", async () => {
                    if (!me?.id) return;
                    const name = `Open ${new Date().toLocaleString()}`;
                    const res = await createTournament({ name, admin_id: me.id, max_players: 8 });
                    activeId = res.tournament_id;
                    sessionStorage.setItem("activeTournamentId", String(activeId));
                    loadAndRender();
                });
                return;
            }

            sessionStorage.setItem("activeTournamentId", String(activeId));
            localStorage.setItem("activeTournamentId", String(activeId));

        const bracketData = await fetchTournamentBracket(activeId);
        const rounds = bracketData.rounds as { quarter: MatchLight[]; semi: MatchLight[]; final: MatchLight[] };
        const nextMatch = findNextMatch(rounds);

        const tournament = bracketData.tournament;
        const players = bracketData.players || [];
            const isInTournament = players.some((p: any) => p.user_id === me?.id);
            const canJoin = tournament.status !== "finished" && tournament.player_count < 8 && !isInTournament;

            const optionsHtml = tournaments
                .map(
                    (t: any) =>
                        `<option value="${t.tournament_id}" ${t.tournament_id === activeId ? "selected" : ""}>#${t.tournament_id} - ${t.name}</option>`
                )
                .join("");

            container.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="flex flex-wrap items-center gap-3 justify-between">
                        <div>
                            <p class="text-xs text-gray-400">Tournament ID #${tournament.tournament_id}</p>
                            <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">${tournament.name}</h1>
                            <p class="text-gray-500">Status: <strong>${tournament.status}</strong> • Players ${tournament.player_count}/8</p>
                        </div>
                        <div class="flex gap-2 items-center">
                            <select id="tournamentSelector" class="border rounded px-2 py-1 text-sm">${optionsHtml}</select>
                            <button id="refreshBracket" class="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">Refresh</button>
                            ${canJoin ? `<button id="joinTournament" class="px-3 py-1 bg-blue-600 text-white rounded">Join</button>` : ""}
                            <button id="newTournament" class="px-3 py-1 bg-indigo-600 text-white rounded">New tournament</button>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-3 gap-4">
                        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow col-span-1">
                            <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-2">Players (${players.length}/8)</h3>
                        <ul class="space-y-1 text-gray-600 dark:text-gray-300 text-sm">
                            ${players
                                .map(
                                    (p: any, idx: number) =>
                                        `<li class="flex items-center gap-2">
                                            <span class="text-gray-400">${idx + 1}.</span>
                                            <img src="${p.avatar || "/uploads/default.png"}" class="w-6 h-6 rounded-full object-cover border" />
                                            ${p.displayName || p.username || p.name || `Player ${p.player_id}`}
                                        </li>`
                                )
                                .join("")}
                        </ul>
                            <p class="text-xs text-gray-400 mt-2">Bracket starts automatically when 8 players joined.</p>
                        </div>
                        <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Quarter-finals</h3>
                                <div class="space-y-2">
                                    ${rounds.quarter?.length
                                        ? rounds.quarter.map((m) => renderMatchCard(m)).join("")
                                        : `<p class="text-gray-500 text-sm">Waiting for 8 players...</p>`}
                                </div>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Semi-finals</h3>
                                <div class="space-y-2">
                                    ${rounds.semi?.length
                                        ? rounds.semi.map((m) => renderMatchCard(m)).join("")
                                        : `<p class="text-gray-500 text-sm">Waiting for quarter winners</p>`}
                                </div>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Final</h3>
                                <div class="space-y-2">
                                    ${rounds.final?.length
                                        ? rounds.final.map((m) => renderMatchCard(m)).join("")
                                        : `<p class="text-gray-500 text-sm">Waiting for semi winners</p>`}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        ${
                            tournament.status === "finished" && bracketData.tournament.WinnerName
                                ? `<div class="flex items-center gap-2 text-green-600 font-semibold">
                                        <img src="${bracketData.tournament.WinnerAvatar || "/uploads/default.png"}" class="w-8 h-8 rounded-full object-cover border" />
                                        <span>Winner: ${bracketData.tournament.WinnerName}</span>
                                   </div>`
                                : nextMatch
                                ? `<div class="flex items-center justify-between">
                                    <div class="text-gray-700 dark:text-gray-200">
                                        <p class="font-semibold">Next match (${nextMatch.round})</p>
                                        <p class="text-sm">${nextMatch.match.player1?.name || "TBD"} vs ${nextMatch.match.player2?.name || "TBD"}</p>
                                    </div>
                                    <button id="startMatch" class="px-4 py-2 bg-green-600 text-white rounded">Play locally</button>
                                   </div>`
                                : tournament.player_count < 8
                                ? `<p class="text-gray-500 text-sm">Waiting for players to reach 8 to seed the bracket.</p>`
                                : `<p class="text-gray-500 text-sm">Bracket is complete.</p>`
                        }
                    </div>
                </div>
            `;

        document.getElementById("refreshBracket")?.addEventListener("click", loadAndRender);
        document.getElementById("tournamentSelector")?.addEventListener("change", (e) => {
            const val = (e.target as HTMLSelectElement).value;
            if (val) {
                activeId = Number(val);
                sessionStorage.setItem("activeTournamentId", val);
                loadAndRender();
            }
        });

        document.getElementById("newTournament")?.addEventListener("click", async () => {
            if (!me?.id) {
                alert("You must be logged in to create a tournament.");
                return;
            }
            try {
                const name = `Open ${new Date().toLocaleString()}`;
                const res = await createTournament({ name, admin_id: me.id, max_players: 8 });
                activeId = res.tournament_id;
                sessionStorage.setItem("activeTournamentId", String(activeId));
                localStorage.setItem("activeTournamentId", String(activeId));
                await loadAndRender();
            } catch (err: any) {
                alert(err?.message || "Failed to create tournament");
            }
        });

        if (canJoin) {
            document.getElementById("joinTournament")?.addEventListener("click", async () => {
                try {
                    await joinTournament({
                        tournament_id: tournament.tournament_id,
                        user_id: me.id,
                        nickname: me.username,
                    });
                    loadAndRender();
                } catch (err: any) {
                    alert(err.message || "Unable to join tournament");
                }
            });
        }

        if (nextMatch) {
            document.getElementById("startMatch")?.addEventListener("click", async () => {
                const match = nextMatch.match;
                const labels = {
                    p1: match.player1?.name || match.player1?.displayName || "P1",
                    p2: match.player2?.name || match.player2?.displayName || "P2",
                };
                await showGame(container, "local-duo", {
                    playerLabels: labels,
                    onEnd: async (res) => {
                        const winnerKey = res.winner;
                        const scores = res.scores || {};
                        let winnerId =
                            winnerKey === "p1"
                                ? match.player1?.id || match.player1?.user_id
                                : winnerKey === "p2"
                                ? match.player2?.id || match.player2?.user_id
                                : undefined;

                        if (!winnerId) {
                            const p1Score = scores.p1 ?? 0;
                            const p2Score = scores.p2 ?? 0;
                            winnerId = p1Score >= p2Score ? (match.player1?.id || match.player1?.user_id) : (match.player2?.id || match.player2?.user_id);
                        }

                        if (!winnerId) return;
                        try {
                            await reportTournamentResult(tournament.tournament_id, match.match_id, Number(winnerId), scores);
                        } catch (err) {
                            console.error(err);
                            alert("Failed to record match result");
                        } finally {
                            await loadAndRender();
                        }
                    },
                });
            });
        }
        } catch (err: any) {
            console.error(err);
            container.innerHTML = `<p class="text-red-500">Failed to load tournament: ${err?.message || err}</p>`;
        }
    }

    await loadAndRender();
}
