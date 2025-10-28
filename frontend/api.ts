export async function fetchPlayers(tournamentId: number) {
  const res = await fetch(`/api/tournament/${tournamentId}/players`);
  return res.json();
}

export async function registerAlias(userId: number, alias: string) {
  const res = await fetch(`/api/alias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, alias })
  });
  return res.json();
}

export async function sendMatchResult(matchId: number, winnerId: number) {
  await fetch(`/api/tournament/match/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, winnerId })
  });
}
