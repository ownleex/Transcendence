import { fetchPlayers } from "./api";

export async function showTournament(container: HTMLElement) {
  const tournamentId = 1; // Example tournament
  const players = await fetchPlayers(tournamentId);

  const list = document.createElement("ul");
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.alias;
    list.appendChild(li);
  });
  container.appendChild(list);

  container.innerHTML += `<p>Next match: ${players[0]?.alias} vs ${players[1]?.alias}</p>`;
}
