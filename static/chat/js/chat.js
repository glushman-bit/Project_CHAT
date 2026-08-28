const roomName = chatConfig.roomName;
let chatSocket = null;
const isAuthenticated = chatConfig.isAuthenticated;

// =========================
// DOM elements
// =========================
const loginContainer = document.getElementById("login-container");
const registerContainer = document.getElementById("register-container");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const showRegisterButton = document.getElementById("show-register");
const showLoginButton = document.getElementById("show-login");
const chatLog = document.getElementById("chat-log");

// =========================
// WebSocket
// =========================
if (isAuthenticated) {
    connectWebSocket();
}

function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    chatSocket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${roomName}/`);

    chatSocket.onmessage = function (event) {
        const data = JSON.parse(event.data);

        if (data.type === "history") {
            data.messages.forEach(addMessage);
            scrollToBottom(false);
        }

        if (data.type === "message") {
            addMessage(data);
            scrollToBottom(true);
        }

        if (data.type === "error") {
            showError(data.message);
        }

        if (data.type === "online_users") {
            updateOnlineUsers(data.users);
        }

        if (data.type === "user_status") {
            showSystemMessage(data.username, data.action);
            scrollToBottom(true);
        }
    };

    chatSocket.onclose = function () {
        console.log("WebSocket connection closed");
        // Опционально: попытка переподключения через 3 секунды
        setTimeout(connectWebSocket, 3000);
    };
}

function updateOnlineUsers(users) {
    const container = document.getElementById("online-users-list");
    const count = document.getElementById("online-users-count");

    container.innerHTML = "";
    count.textContent = users.length;

    users.forEach(function (username) {
        const element = document.createElement("div");
        element.classList.add("online-user");
        element.textContent = username;
        container.appendChild(element);
    });
}

// =========================
// Messages
// =========================
function addMessage(data) {
    const messageElement = document.createElement("div");
    const currentUser = chatConfig.username;

    if (data.username === currentUser) {
        messageElement.classList.add("message", "own");
    } else {
        messageElement.classList.add("message");
    }

    const content = document.createElement("div");
    content.classList.add("message-content");

    const username = document.createElement("div");
    username.classList.add("username");

    const avatar = document.createElement("span");
    avatar.classList.add("message-avatar");

    if (data.avatar) {
        const avatarImage = document.createElement("img");
        avatarImage.src = data.avatar;
        avatarImage.alt = `Аватар ${data.username}`;
        avatar.appendChild(avatarImage);
    } else {
        avatar.textContent = data.username.charAt(0).toUpperCase();
    }

    const usernameText = document.createElement("span");
    usernameText.textContent = data.username;

    username.appendChild(avatar);
    username.appendChild(usernameText);

    const text = document.createElement("div");
    text.classList.add("text");
    text.textContent = data.message;

    const time = document.createElement("div");
    time.classList.add("time");
    const date = new Date(data.created_at);
    time.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    content.appendChild(username);
    content.appendChild(text);
    content.appendChild(time);

    messageElement.appendChild(content);
    chatLog.appendChild(messageElement);
}

function showSystemMessage(username, action) {
    const element = document.createElement("div");
    element.classList.add("system-message");

    if (action === "join") {
        element.textContent = `🟢 ${username} вошёл в чат`;
    } else if (action === "leave") {
        element.textContent = `🔴 ${username} вышел из чата`;
    }

    chatLog.appendChild(element);
}

function scrollToBottom(smooth = true) {
    if (smooth) {
        chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: "smooth" });
    } else {
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function showError(message) {
    const errorElement = document.getElementById("login-error") || document.getElementById("register-error");
    if (errorElement) {
        errorElement.textContent = message;
        setTimeout(() => {
            errorElement.textContent = "";
        }, 4000);
    }
}

// =========================
// Send message
// =========================
function sendMessage() {
    const input = document.getElementById("chat-message-input");
    const message = input.value.trim();

    if (!message) return;

    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
        alert("Соединение с чатом потеряно. Перезагрузите страницу.");
        return;
    }

    chatSocket.send(JSON.stringify({ message: message }));
    input.value = "";
    input.focus();
}

document.getElementById("chat-message-submit").addEventListener("click", sendMessage);

document.getElementById("chat-message-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

// =========================
// Auth & UI Logic
// =========================
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const errorElement = document.getElementById("login-error");
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

    errorElement.textContent = "Выполняется вход...";

    try {
        const response = await fetch(chatConfig.loginUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRFToken": csrfToken,
            },
            body: new URLSearchParams({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            errorElement.textContent = data.error || "Ошибка входа";
            return;
        }

        window.location.reload();
    } catch (err) {
        errorElement.textContent = "Ошибка сети. Попробуйте позже.";
    }
});

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = document.getElementById("register-username").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const passwordConfirm = document.getElementById("register-password-confirm").value;
    const errorElement = document.getElementById("register-error");
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

    errorElement.textContent = "Создание аккаунта...";

    try {
        const response = await fetch(chatConfig.registerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRFToken": csrfToken,
            },
            body: new URLSearchParams({ username, email, password, password_confirm: passwordConfirm }),
        });

        const data = await response.json();

        if (!response.ok) {
            showRegistrationErrors(data.errors || { general: ["Ошибка регистрации"] });
            return;
        }

        window.location.reload();
    } catch (err) {
        errorElement.textContent = "Ошибка сети. Попробуйте позже.";
    }
});

function showRegistrationErrors(errors) {
    const errorElement = document.getElementById("register-error");
    const messages = [];

    for (const field in errors) {
        if (Array.isArray(errors[field])) {
            errors[field].forEach(err => {
                messages.push(typeof err === 'object' ? err.message : err);
            });
        } else {
            messages.push(errors[field]);
        }
    }

    errorElement.textContent = messages.join(" • ");
}

// =========================
// Modal Switching
// =========================
showRegisterButton.addEventListener("click", function () {
    loginContainer.classList.add("hidden");
    registerContainer.classList.remove("hidden");
    document.getElementById("register-error").textContent = "";
});

showLoginButton.addEventListener("click", function () {
    registerContainer.classList.add("hidden");
    loginContainer.classList.remove("hidden");
    document.getElementById("login-error").textContent = "";
});

// =========================
// User Menu & Logout
// =========================
const userMenuButton = document.getElementById("user-menu-button");
const userMenuDropdown = document.getElementById("user-menu-dropdown");
const logoutButton = document.getElementById("logout-button");

if (userMenuButton) {
    userMenuButton.addEventListener("click", function (event) {
        event.stopPropagation();
        userMenuDropdown.classList.toggle("hidden");
    });
}

document.addEventListener("click", function () {
    if (userMenuDropdown) {
        userMenuDropdown.classList.add("hidden");
    }
});

if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

        if (chatSocket) {
            chatSocket.close();
        }

        try {
            const response = await fetch(chatConfig.logoutUrl, {
                method: "POST",
                headers: {
                    "X-CSRFToken": csrfToken,
                },
            });

            if (response.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error("Logout error:", err);
        }
    });
}