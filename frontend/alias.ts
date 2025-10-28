import { fetchPlayers, registerAlias } from "./api";

export async function showAliasForm(container: HTMLElement, userId: number, tournamentId: number) {
  const form = document.createElement("form");
  form.innerHTML = `
    <input type="text" placeholder="Enter alias" class="px-2 py-1 rounded text-black"/>
    <button type="submit" class="px-4 py-1 bg-green-500 rounded">Register</button>
  `;
  container.appendChild(form);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const input = form.querySelector("input") as HTMLInputElement;
    await registerAlias(userId, input.value);
    container.innerHTML = "<p>Alias registered!</p>";
  };
}
