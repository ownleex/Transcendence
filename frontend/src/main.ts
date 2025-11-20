import { showHome } from "./home";
import { showGame } from "./pong";
import { showTournament } from "./tournament";
import { sendFriendRequest, acceptFriend, getFriends, getIncomingRequests, getSentRequests } from "./api";

const app = document.getElementById("pongContent")!;

function router() {
    const hash = window.location.hash;

    app.innerHTML = ""; 

    if (!hash || hash === "#home") {
        showHome(app);
    } else if (hash === "#game") {
        showGame(app);
    } else if (hash === "#tournament") {
        showTournament(app);
    } else {
        app.innerHTML = `<p class="text-red-500">Page not found</p>`;
    }
}

// Top navbar buttons
document.getElementById("homeBtn")!.onclick = () => (window.location.hash = "#home");
document.getElementById("tournamentBtn")!.onclick = () => (window.location.hash = "#tournament");

window.addEventListener("hashchange", router);
window.addEventListener("load", router);


const me = JSON.parse(localStorage.getItem("me") || "{}");
const currentUserId = me.id;

// Show friends panel
window.showFriendsPanel = function () {
    document.getElementById("friends-panel")!.classList.remove("hidden");
    loadAllFriendsData();
};

// ----------------------------
// Load all friend data
// ----------------------------
async function loadAllFriendsData() {
    await loadFriendList();
    await loadIncomingRequests();
    await loadSentRequests();
}

// ----------------------------
// Friends (accepted)
// ----------------------------
async function loadFriendList() {
    const container = document.getElementById("friends-list")!;
    container.innerHTML = "Loading...";

    const res = await getFriends(currentUserId);
    if (!res.success) {
        container.innerHTML = "Failed to load friends";
        return;
    }

    container.innerHTML = "";
    res.friends.forEach(friend => {
        const item = document.createElement("div");
        item.className = "p-2 border rounded mb-1 flex justify-between items-center";

        item.innerHTML = `
            <span>${friend.username}</span>
            <span class="${friend.online ? "text-green-500" : "text-gray-500"}">
                ${friend.online ? "● online" : "○ offline"}
            </span>
        `;
        container.appendChild(item);
    });
}

// ----------------------------
// Incoming friend requests
// ----------------------------
async function loadIncomingRequests() {
    const container = document.getElementById("friends-incoming")!;
    container.innerHTML = "Loading...";

    const res = await getIncomingRequests(currentUserId);
    if (!res.success) {
        container.innerHTML = "Failed to load requests";
        return;
    }

    container.innerHTML = "";
    res.requests.forEach(req => {
        const div = document.createElement("div");
        div.className = "p-2 border rounded mb-1 flex justify-between items-center";

        div.innerHTML = `
            <span>${req.username}</span>
            <button class="accept-btn px-2 py-1 bg-green-600 text-white text-xs rounded" data-id="${req.id}">
                Accept
            </button>
        `;
        container.appendChild(div);
    });

    // Attach event listeners
    container.querySelectorAll(".accept-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const friendId = btn.getAttribute("data-id");
            if (!friendId) return;

            const result = await acceptFriend(Number(friendId));
            if (result.success) loadAllFriendsData();
        });
    });
}

// ----------------------------
// Sent friend requests
// ----------------------------
async function loadSentRequests() {
    const container = document.getElementById("friends-sent")!;
    container.innerHTML = "Loading...";

    const res = await getSentRequests(currentUserId);
    if (!res.success) {
        container.innerHTML = "Failed to load sent requests";
        return;
    }

    container.innerHTML = "";
    res.sent.forEach(req => {
        const div = document.createElement("div");
        div.className = "p-2 border rounded mb-1 flex justify-between items-center";

        div.innerHTML = `
            <span>${req.username}</span>
            <span class="text-yellow-500 text-xs">Pending</span>
        `;

        container.appendChild(div);
    });
}

// ----------------------------
// Send friend request form
// ----------------------------
const friendForm = document.getElementById("friend-send-form") as HTMLFormElement;
friendForm.addEventListener("submit", async e => {
    e.preventDefault();

    const input = document.getElementById("friend-username-input") as HTMLInputElement;
    const username = input.value.trim();
    const messageEl = document.getElementById("friend-send-message")!;
    if (!username) return;

    try {
        await sendFriendRequest(username);
        messageEl.textContent = `Friend request sent to ${username}`;
        input.value = "";
        loadAllFriendsData();
    } catch (err: any) {
        messageEl.textContent = err.message;
    }
});

// ----------------------------
// Load friends on page load
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
    if (currentUserId) loadAllFriendsData();
});
