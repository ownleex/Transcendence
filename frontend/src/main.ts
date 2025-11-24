import { showHome } from "./home";
import { showGame } from "./pong";
import { showTournament } from "./tournament";
import { sendFriendRequest, acceptFriend, getFriends, getIncomingRequests, getSentRequests } from "./api";
import { io } from "socket.io-client";

window.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("pongContent")!;
    const gameContainer = document.getElementById("gameContainer")!;

    // -------------------------
    // Router for hash navigation
    // -------------------------
    function router() {
        const hash = window.location.hash;

        // Keep #gameContainer intact, only update app content
        const appContent = document.createElement("div");
        appContent.id = "appContent";

        if (!hash || hash === "#home") {
            showHome(appContent);
        } else if (hash === "#tournament") {
            showTournament(appContent);
        } else {
            appContent.innerHTML = `<p class="text-red-500">Page not found</p>`;
        }

        // Clear old content except #gameContainer
        const oldContent = document.getElementById("appContent");
        if (oldContent) oldContent.remove();
        app.prepend(appContent);
    }

    // -------------------------
    // Quick play buttons
    // -------------------------
    const playDuoBtn = document.getElementById("playDuoBtn");
    const playQuadBtn = document.getElementById("playQuadBtn");

    playDuoBtn?.addEventListener("click", () => {
        showGame(gameContainer, "duo");
    });

    playQuadBtn?.addEventListener("click", () => {
        showGame(gameContainer, "quad");
    });

    // -------------------------
    // Top navbar buttons
    // -------------------------
    const homeBtn = document.getElementById("homeBtn");
    const viewTournamentBtn = document.getElementById("viewtournamentBtn");

    homeBtn?.addEventListener("click", () => window.location.hash = "#home");
    viewTournamentBtn?.addEventListener("click", () => window.location.hash = "#tournament");

    // -------------------------
    // Event listeners for routing
    // -------------------------
    window.addEventListener("hashchange", router);

    // Initial render
    router();
});

const me = JSON.parse(localStorage.getItem("me") || "{}");
const currentUserId = me.id;

// Show friends panel
window.showFriendsPanel = function () {
    document.getElementById("friends-panel")!.classList.remove("hidden");
    loadAllFriendsData();
};

// ----------------------------
// Friends (accepted)
// ----------------------------
let socket: ReturnType<typeof io> | null = null;

function initSocket(friendsIds: number[]) {
    if (!socket) {
        const token = localStorage.getItem("token");
        if (!token) return;

        socket = io("https://localhost:3000", { auth: { token } });

        // Friend online/offline updates
        socket.on("user:online", ({ userId }) => updateFriendStatus(userId, true));
        socket.on("user:offline", ({ userId }) => updateFriendStatus(userId, false));

        socket.on("connect", () => {
            socket!.emit("get:onlineFriends", friendsIds);
        });

        socket.on("onlineFriends", (onlineIds: number[]) => {
            onlineIds.forEach(id => updateFriendStatus(id, true));
        });
    }
}

// ----------------------------
// Load friend list
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
        item.id = `friend-${friend.id}`;
        item.setAttribute("data-user-id", friend.id.toString());
        item.className = "p-2 border rounded mb-1 flex justify-between items-center";

        item.innerHTML = `
            <span>${friend.username}</span>
            <span class="status text-gray-500">○ offline</span>
        `;

        container.appendChild(item);
    });

    // Init socket now that we have friend IDs
    initSocket(res.friends.map(f => f.id));
}

// ----------------------------
// Update friend status dynamically
// ----------------------------
function updateFriendStatus(userId: number, online: boolean) {
    const el = document.querySelector(`[data-user-id="${userId}"] .status`);
    if (el) {
        el.textContent = online ? "● online" : "○ offline";
        el.className = online ? "status text-green-500" : "status text-gray-500";
    }
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
// Load all friend data
// ----------------------------
async function loadAllFriendsData() {
    await loadFriendList();
    await loadIncomingRequests();
    await loadSentRequests();
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
