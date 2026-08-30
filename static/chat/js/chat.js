const roomName = chatConfig.roomName;

let chatSocket = null;
let reconnectTimeout = null;
let shouldReconnect = true;

const isAuthenticated = chatConfig.isAuthenticated;


// ==================================================
// DOM
// ==================================================

const loginContainer =
    document.getElementById("login-container");

const registerContainer =
    document.getElementById("register-container");

const loginForm =
    document.getElementById("login-form");

const registerForm =
    document.getElementById("register-form");

const showRegisterButton =
    document.getElementById("show-register");

const showLoginButton =
    document.getElementById("show-login");

const chatLog =
    document.getElementById("chat-log");


// ==================================================
// Common helpers
// ==================================================

function getCsrfToken() {

    const csrfInput =
        document.querySelector(
            "[name=csrfmiddlewaretoken]"
        );

    return csrfInput
        ? csrfInput.value
        : "";
}


function showError(message) {

    const errorElement =
        document.getElementById("login-error")
        ||
        document.getElementById("register-error");

    if (!errorElement) {
        return;
    }

    errorElement.textContent = message;

    setTimeout(function () {
        errorElement.textContent = "";
    }, 4000);
}


function extractFormErrors(errors) {

    if (!errors) {
        return "";
    }

    const messages = [];

    for (const field in errors) {

        const fieldErrors =
            errors[field];

        if (Array.isArray(fieldErrors)) {

            fieldErrors.forEach(function (error) {

                messages.push(
                    typeof error === "object"
                        ? error.message
                        : error
                );
            });

        } else {

            messages.push(fieldErrors);
        }
    }

    return messages.join(" • ");
}


async function apiRequest(
    url,
    options = {}
) {

    const headers = {
        "X-CSRFToken": getCsrfToken(),
        ...(options.headers || {}),
    };

    return fetch(
        url,
        {
            ...options,
            headers,
        }
    );
}


// ==================================================
// Modal helpers
// ==================================================

function openModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");
}


function closeModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
}


function showModalError(
    element,
    message
) {

    if (!element) {
        return;
    }

    element.textContent = message;

    element.classList.remove("hidden");
}


function clearModalError(element) {

    if (!element) {
        return;
    }

    element.textContent = "";

    element.classList.add("hidden");
}


// ==================================================
// WebSocket
// ==================================================

if (isAuthenticated) {
    connectWebSocket();
}


function connectWebSocket() {

    if (!shouldReconnect) {
        return;
    }

    const protocol =
        window.location.protocol === "https:"
            ? "wss:"
            : "ws:";

    chatSocket =
        new WebSocket(
            `${protocol}//${window.location.host}/ws/chat/${encodeURIComponent(roomName)}/`
        );


    chatSocket.onmessage =
        handleWebSocketMessage;


    chatSocket.onclose =
        handleWebSocketClose;


    chatSocket.onerror =
        function (error) {

            console.error(
                "WebSocket error:",
                error
            );
        };
}


function handleWebSocketMessage(event) {

    const data =
        JSON.parse(event.data);


    switch (data.type) {

        case "history":

            data.messages.forEach(
                addMessage
            );

            scrollToBottom(false);

            break;


        case "message":

            addMessage(data);

            scrollToBottom(true);

            break;


        case "error":

            showError(data.message);

            break;


        case "online_users":

            updateOnlineUsers(
                data.users
            );

            break;


        case "user_status":

            showSystemMessage(
                data.username,
                data.action
            );

            scrollToBottom(true);

            break;


        default:

            console.warn(
                "Unknown WebSocket message:",
                data
            );
    }
}


function handleWebSocketClose() {

    console.log(
        "WebSocket connection closed"
    );

    if (!shouldReconnect) {
        return;
    }

    clearTimeout(
        reconnectTimeout
    );

    reconnectTimeout =
        setTimeout(
            connectWebSocket,
            3000
        );
}


// ==================================================
// Online users
// ==================================================

function updateOnlineUsers(users) {

    const onlineUsers =
        new Set(users);

    const members =
        document.querySelectorAll(
            ".room-member"
        );


    members.forEach(function (member) {

        const username =
            member.dataset.username;

        const status =
            member.querySelector(
                ".participant-status"
            );

        if (!status) {
            return;
        }

        status.classList.toggle(
            "online",
            onlineUsers.has(username)
        );
    });
}


// ==================================================
// Messages
// ==================================================

function addMessage(data) {

    if (!chatLog) {
        return;
    }


    const messageElement =
        document.createElement("div");

    const currentUser =
        chatConfig.username;


    messageElement.classList.add(
        "message"
    );


    if (data.username === currentUser) {

        messageElement.classList.add(
            "own"
        );
    }


    const content =
        document.createElement("div");

    content.classList.add(
        "message-content"
    );


    const username =
        document.createElement("div");

    username.classList.add(
        "username"
    );


    const avatar =
        createAvatar(
            data.username,
            data.avatar,
            "message-avatar"
        );


    const usernameText =
        document.createElement("span");

    usernameText.textContent =
        data.username;


    username.appendChild(avatar);
    username.appendChild(usernameText);


    const text =
        document.createElement("div");

    text.classList.add("text");

    text.textContent =
        data.message;


    const time =
        document.createElement("div");

    time.classList.add("time");


    const date =
        new Date(data.created_at);


    time.textContent =
        date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        );


    content.appendChild(username);
    content.appendChild(text);
    content.appendChild(time);


    messageElement.appendChild(
        content
    );


    chatLog.appendChild(
        messageElement
    );
}


function createAvatar(
    name,
    imageUrl,
    className
) {

    const avatar =
        document.createElement("span");

    avatar.classList.add(
        className
    );


    if (imageUrl) {

        const image =
            document.createElement("img");

        image.src =
            imageUrl;

        image.alt =
            `Аватар ${name}`;

        avatar.appendChild(image);

    } else {

        avatar.textContent =
            name
                .charAt(0)
                .toUpperCase();
    }


    return avatar;
}


function showSystemMessage(
    username,
    action
) {

    if (!chatLog) {
        return;
    }


    const element =
        document.createElement("div");

    element.classList.add(
        "system-message"
    );


    if (action === "join") {

        element.textContent =
            `🟢 ${username} вошёл в чат`;

    } else if (action === "leave") {

        element.textContent =
            `🔴 ${username} вышел из чата`;

    } else {

        return;
    }


    chatLog.appendChild(element);
}


function scrollToBottom(
    smooth = true
) {

    if (!chatLog) {
        return;
    }


    if (smooth) {

        chatLog.scrollTo({
            top: chatLog.scrollHeight,
            behavior: "smooth",
        });

    } else {

        chatLog.scrollTop =
            chatLog.scrollHeight;
    }
}


// ==================================================
// Send message
// ==================================================

function sendMessage() {

    const input =
        document.getElementById(
            "chat-message-input"
        );


    if (!input) {
        return;
    }


    const message =
        input.value.trim();


    if (!message) {
        return;
    }


    if (
        !chatSocket
        ||
        chatSocket.readyState !== WebSocket.OPEN
    ) {

        alert(
            "Соединение с чатом потеряно. " +
            "Перезагрузите страницу."
        );

        return;
    }


    chatSocket.send(
        JSON.stringify({
            message,
        })
    );


    input.value = "";

    input.focus();
}


const messageSubmitButton =
    document.getElementById(
        "chat-message-submit"
    );


const messageInput =
    document.getElementById(
        "chat-message-input"
    );


if (messageSubmitButton) {

    messageSubmitButton.addEventListener(
        "click",
        sendMessage
    );
}


if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
                &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


// ==================================================
// Authentication
// ==================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        handleLogin
    );
}


async function handleLogin(event) {

    event.preventDefault();


    const username =
        document.getElementById(
            "login-username"
        ).value;


    const password =
        document.getElementById(
            "login-password"
        ).value;


    const errorElement =
        document.getElementById(
            "login-error"
        );


    errorElement.textContent =
        "Выполняется вход...";


    try {

        const response =
            await apiRequest(
                chatConfig.loginUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                    },

                    body:
                        new URLSearchParams({
                            username,
                            password,
                        }),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            errorElement.textContent =
                data.error ||
                "Ошибка входа.";

            return;
        }


        window.location.reload();

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        errorElement.textContent =
            "Ошибка сети. Попробуйте позже.";
    }
}


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        handleRegistration
    );
}


async function handleRegistration(event) {

    event.preventDefault();


    const username =
        document.getElementById(
            "register-username"
        ).value;


    const email =
        document.getElementById(
            "register-email"
        ).value;


    const password =
        document.getElementById(
            "register-password"
        ).value;


    const passwordConfirm =
        document.getElementById(
            "register-password-confirm"
        ).value;


    const errorElement =
        document.getElementById(
            "register-error"
        );


    errorElement.textContent =
        "Создание аккаунта...";


    try {

        const response =
            await apiRequest(
                chatConfig.registerUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                    },

                    body:
                        new URLSearchParams({
                            username,
                            email,
                            password,
                            password_confirm:
                                passwordConfirm,
                        }),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showRegistrationErrors(
                data.errors
                ||
                {
                    general: [
                        "Ошибка регистрации",
                    ],
                }
            );

            return;
        }


        window.location.reload();

    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        errorElement.textContent =
            "Ошибка сети. Попробуйте позже.";
    }
}


function showRegistrationErrors(errors) {

    const errorElement =
        document.getElementById(
            "register-error"
        );


    if (!errorElement) {
        return;
    }


    errorElement.textContent =
        extractFormErrors(errors);
}


// ==================================================
// Authentication modal switching
// ==================================================

if (showRegisterButton) {

    showRegisterButton.addEventListener(
        "click",
        function () {

            loginContainer?.classList.add(
                "hidden"
            );

            registerContainer?.classList.remove(
                "hidden"
            );


            const error =
                document.getElementById(
                    "register-error"
                );

            if (error) {
                error.textContent = "";
            }
        }
    );
}


if (showLoginButton) {

    showLoginButton.addEventListener(
        "click",
        function () {

            registerContainer?.classList.add(
                "hidden"
            );

            loginContainer?.classList.remove(
                "hidden"
            );


            const error =
                document.getElementById(
                    "login-error"
                );

            if (error) {
                error.textContent = "";
            }
        }
    );
}


// ==================================================
// User menu
// ==================================================

const userMenuButton =
    document.getElementById(
        "user-menu-button"
    );


const userMenuDropdown =
    document.getElementById(
        "user-menu-dropdown"
    );


const logoutButton =
    document.getElementById(
        "logout-button"
    );


if (userMenuButton) {

    userMenuButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            userMenuDropdown?.classList.toggle(
                "hidden"
            );
        }
    );
}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        handleLogout
    );
}


async function handleLogout() {

    shouldReconnect = false;

    clearTimeout(
        reconnectTimeout
    );


    if (chatSocket) {

        chatSocket.onclose = null;

        chatSocket.close();
    }


    try {

        const response =
            await apiRequest(
                chatConfig.logoutUrl,
                {
                    method: "POST",
                }
            );


        if (response.ok) {

            window.location.reload();

        } else {

            console.error(
                "Logout failed:",
                response.status
            );
        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }
}


// ==================================================
// Room menu
// ==================================================

const roomMenuButton =
    document.getElementById(
        "room-menu-button"
    );


const roomMenuDropdown =
    document.getElementById(
        "room-menu-dropdown"
    );


if (roomMenuButton) {

    roomMenuButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();


            userMenuDropdown?.classList.add(
                "hidden"
            );


            roomMenuDropdown?.classList.toggle(
                "hidden"
            );
        }
    );
}


// ==================================================
// Global menu closing
// ==================================================

document.addEventListener(
    "click",
    function () {

        userMenuDropdown?.classList.add(
            "hidden"
        );

        roomMenuDropdown?.classList.add(
            "hidden"
        );
    }
);


// ==================================================
// Create room
// ==================================================

const createRoomButton =
    document.getElementById(
        "create-room-button"
    );


const createRoomModal =
    document.getElementById(
        "create-room-modal"
    );


const createRoomForm =
    document.getElementById(
        "create-room-form"
    );


const createRoomError =
    document.getElementById(
        "create-room-error"
    );


if (createRoomButton) {

    createRoomButton.addEventListener(
        "click",
        function () {

            createRoomForm?.reset();

            clearModalError(
                createRoomError
            );

            openModal(
                createRoomModal
            );
        }
    );
}


if (createRoomForm) {

    createRoomForm.addEventListener(
        "submit",
        handleCreateRoom
    );
}


async function handleCreateRoom(event) {

    event.preventDefault();


    clearModalError(
        createRoomError
    );


    const submitButton =
        createRoomForm.querySelector(
            "button[type=submit]"
        );


    submitButton.disabled = true;

    submitButton.textContent =
        "Создание...";


    try {

        const response =
            await apiRequest(
                chatConfig.createRoomUrl,
                {
                    method: "POST",

                    body:
                        new FormData(
                            createRoomForm
                        ),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showModalError(
                createRoomError,
                extractFormErrors(
                    data.errors
                )
                ||
                data.error
                ||
                "Не удалось создать комнату."
            );

            return;
        }


        closeModal(
            createRoomModal
        );


        const roomUrl =
            chatConfig.roomUrlTemplate
                .replace(
                    "ROOM_NAME",
                    encodeURIComponent(
                        data.room.name
                    )
                );


        window.location.href =
            roomUrl;

    } catch (error) {

        console.error(
            "Create room error:",
            error
        );

        showModalError(
            createRoomError,
            "Ошибка сети. Попробуйте позже."
        );

    } finally {

        submitButton.disabled = false;

        submitButton.textContent =
            "Создать";
    }
}


// ==================================================
// Edit room
// ==================================================

const editRoomButton =
    document.getElementById(
        "edit-room-button"
    );


const editRoomModal =
    document.getElementById(
        "edit-room-modal"
    );


const editRoomForm =
    document.getElementById(
        "edit-room-form"
    );


const editRoomError =
    document.getElementById(
        "edit-room-error"
    );


if (editRoomButton) {

    editRoomButton.addEventListener(
        "click",
        function () {

            roomMenuDropdown?.classList.add(
                "hidden"
            );

            clearModalError(
                editRoomError
            );

            openModal(
                editRoomModal
            );
        }
    );
}


if (editRoomForm) {

    editRoomForm.addEventListener(
        "submit",
        handleEditRoom
    );
}


async function handleEditRoom(event) {

    event.preventDefault();


    clearModalError(
        editRoomError
    );


    const submitButton =
        editRoomForm.querySelector(
            "button[type=submit]"
        );


    submitButton.disabled = true;

    submitButton.textContent =
        "Сохранение...";


    try {

        const response =
            await apiRequest(
                chatConfig.updateRoomUrl,
                {
                    method: "POST",

                    body:
                        new FormData(
                            editRoomForm
                        ),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showModalError(
                editRoomError,
                extractFormErrors(
                    data.errors
                )
                ||
                data.error
                ||
                "Не удалось изменить комнату."
            );

            return;
        }


        updateRoomInterface(
            data.room
        );


        closeModal(
            editRoomModal
        );


        const roomUrl =
            chatConfig.roomUrlTemplate
                .replace(
                    "ROOM_NAME",
                    encodeURIComponent(
                        data.room.name
                    )
                );


        window.location.href =
            roomUrl;

    } catch (error) {

        console.error(
            "Update room error:",
            error
        );

        showModalError(
            editRoomError,
            "Ошибка сети. Попробуйте позже."
        );

    } finally {

        submitButton.disabled = false;

        submitButton.textContent =
            "Сохранить";
    }
}


function updateRoomInterface(room) {

    const title =
        document.getElementById(
            "room-title-name"
        );


    const menuName =
        document.getElementById(
            "room-menu-name"
        );


    const description =
        document.getElementById(
            "room-menu-description"
        );


    if (title) {
        title.textContent =
            room.name;
    }


    if (menuName) {
        menuName.textContent =
            room.name;
    }


    if (description) {

        description.textContent =
            room.description
            ||
            "Без описания";
    }


    updateRoomAvatar(
        "room-avatar",
        room
    );


    updateRoomAvatar(
        "room-menu-avatar",
        room
    );
}


function updateRoomAvatar(
    elementId,
    room
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.innerHTML = "";


    if (room.avatar) {

        const image =
            document.createElement("img");

        image.src =
            room.avatar;

        image.alt =
            room.name;

        element.appendChild(image);

    } else {

        element.textContent =
            room.name
                .charAt(0)
                .toUpperCase();
    }
}


// ==================================================
// Add member
// ==================================================

const addMemberButton =
    document.getElementById(
        "add-member-button"
    );


const addMemberModal =
    document.getElementById(
        "add-member-modal"
    );


const addMemberForm =
    document.getElementById(
        "add-member-form"
    );


const addMemberError =
    document.getElementById(
        "add-member-error"
    );


if (addMemberButton) {

    addMemberButton.addEventListener(
        "click",
        function () {

            clearModalError(
                addMemberError
            );

            openModal(
                addMemberModal
            );
        }
    );
}


if (addMemberForm) {

    addMemberForm.addEventListener(
        "submit",
        handleAddMember
    );
}


async function handleAddMember(event) {

    event.preventDefault();


    clearModalError(
        addMemberError
    );


    const submitButton =
        addMemberForm.querySelector(
            "button[type=submit]"
        );


    submitButton.disabled = true;

    submitButton.textContent =
        "Добавление...";


    try {

        const response =
            await apiRequest(
                chatConfig.addMemberUrl,
                {
                    method: "POST",

                    body:
                        new FormData(
                            addMemberForm
                        ),
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showModalError(
                addMemberError,
                extractFormErrors(
                    data.errors
                )
                ||
                data.error
                ||
                "Не удалось добавить участника."
            );

            return;
        }


        addMemberToMenu(
            data.member
        );


        removeUserFromAvailableList(
            data.member.id
        );


        addMemberForm.reset();


        closeModal(
            addMemberModal
        );

    } catch (error) {

        console.error(
            "Add member error:",
            error
        );

        showModalError(
            addMemberError,
            "Ошибка сети. Попробуйте позже."
        );

    } finally {

        submitButton.disabled = false;

        submitButton.textContent =
            "Добавить";
    }
}


function addMemberToMenu(member) {

    const list =
        document.getElementById(
            "room-members-list"
        );


    if (!list) {
        return;
    }


    const element =
        document.createElement("div");

    element.classList.add(
        "room-member"
    );


    element.dataset.userId =
        member.id;

    element.dataset.username =
        member.username;


    const avatar =
        document.createElement("div");

    avatar.classList.add(
        "room-member-avatar"
    );


    if (member.avatar) {

        const image =
            document.createElement("img");

        image.src =
            member.avatar;

        image.alt =
            member.username;

        avatar.appendChild(image);

    } else {

        avatar.textContent =
            member.username
                .charAt(0)
                .toUpperCase();
    }


    const status =
        document.createElement("span");

    status.classList.add(
        "participant-status"
    );


    const username =
        document.createElement("span");

    username.classList.add(
        "room-member-name"
    );

    username.textContent =
        member.username;


    element.appendChild(avatar);
    element.appendChild(status);
    element.appendChild(username);


    if (chatConfig.isRoomOwner) {

        const removeButton =
            document.createElement("button");

        removeButton.type = "button";

        removeButton.classList.add(
            "remove-member-button"
        );

        removeButton.dataset.userId =
            member.id;

        removeButton.title =
            "Удалить участника";

        removeButton.textContent =
            "×";


        removeButton.addEventListener(
            "click",
            function () {

                removeRoomMember(
                    member.id,
                    member.username,
                    element
                );
            }
        );


        element.appendChild(
            removeButton
        );
    }


    list.appendChild(
        element
    );


    updateRoomMembersCount();
}


function removeUserFromAvailableList(
    userId
) {

    const select =
        document.getElementById(
            "add-member-user"
        );


    if (!select) {
        return;
    }


    const option =
        select.querySelector(
            `option[value="${userId}"]`
        );


    option?.remove();
}


// ==================================================
// Remove member
// ==================================================

document
    .querySelectorAll(
        ".remove-member-button"
    )
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();


                    const userId =
                        button.dataset.userId;


                    const member =
                        button.closest(
                            ".room-member"
                        );


                    if (!member) {
                        return;
                    }


                    const username =
                        member.dataset.username;


                    removeRoomMember(
                        userId,
                        username,
                        member
                    );
                }
            );
        }
    );


async function removeRoomMember(
    userId,
    username,
    element
) {

    const confirmed =
        confirm(
            `Удалить ${username} из комнаты?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await apiRequest(
                `/chat/rooms/${chatConfig.roomId}/members/${userId}/remove/`,
                {
                    method: "POST",
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Не удалось удалить участника."
            );

            return;
        }


        element.remove();

        updateRoomMembersCount();

    } catch (error) {

        console.error(
            "Remove member error:",
            error
        );

        alert(
            "Ошибка сети. Попробуйте позже."
        );
    }
}


// ==================================================
// Join room
// ==================================================

const joinRoomButton =
    document.getElementById(
        "join-room-button"
    );


if (joinRoomButton) {

    joinRoomButton.addEventListener(
        "click",
        handleJoinRoom
    );
}


async function handleJoinRoom() {

    joinRoomButton.disabled = true;

    joinRoomButton.textContent =
        "Вступление...";


    try {

        const response =
            await apiRequest(
                chatConfig.joinRoomUrl,
                {
                    method: "POST",
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Не удалось вступить в комнату."
            );

            return;
        }


        window.location.reload();

    } catch (error) {

        console.error(
            "Join room error:",
            error
        );

        alert(
            "Ошибка сети. Попробуйте позже."
        );

    } finally {

        joinRoomButton.disabled = false;

        joinRoomButton.textContent =
            "Вступить в комнату";
    }
}


// ==================================================
// Leave room
// ==================================================

const leaveRoomButton =
    document.getElementById(
        "leave-room-button"
    );


if (leaveRoomButton) {

    leaveRoomButton.addEventListener(
        "click",
        handleLeaveRoom
    );
}


async function handleLeaveRoom() {

    const confirmed =
        confirm(
            "Вы действительно хотите покинуть этот чат?"
        );


    if (!confirmed) {
        return;
    }


    leaveRoomButton.disabled = true;

    leaveRoomButton.textContent =
        "Выход...";


    try {

        const response =
            await apiRequest(
                chatConfig.leaveRoomUrl,
                {
                    method: "POST",
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.error ||
                "Не удалось покинуть чат."
            );

            return;
        }


        shouldReconnect = false;

        clearTimeout(
            reconnectTimeout
        );


        if (chatSocket) {

            chatSocket.onclose = null;

            chatSocket.close();
        }


        window.location.href =
            data.redirect_url;

    } catch (error) {

        console.error(
            "Leave room error:",
            error
        );

        alert(
            "Ошибка сети. Попробуйте позже."
        );

    } finally {

        leaveRoomButton.disabled = false;

        leaveRoomButton.textContent =
            "🚪 Покинуть чат";
    }
}


// ==================================================
// Room members count
// ==================================================

function updateRoomMembersCount() {

    const list =
        document.getElementById(
            "room-members-list"
        );


    if (!list) {
        return;
    }


    const count =
        list.querySelectorAll(
            ".room-member"
        ).length;


    const headerCount =
        document.getElementById(
            "room-members-count"
        );


    const menuCount =
        document.getElementById(
            "room-members-menu-count"
        );


    if (headerCount) {

        headerCount.textContent =
            count;
    }


    if (menuCount) {

        menuCount.textContent =
            count;
    }
}


// ==================================================
// Modals
// ==================================================

document
    .querySelectorAll(
        "[data-close-modal]"
    )
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const modalId =
                        button.dataset.closeModal;


                    closeModal(
                        document.getElementById(
                            modalId
                        )
                    );
                }
            );
        }
    );


document
    .querySelectorAll(".modal")
    .forEach(
        function (modal) {

            modal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target === modal
                    ) {

                        closeModal(
                            modal
                        );
                    }
                }
            );
        }
    );


document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Escape") {
            return;
        }


        document
            .querySelectorAll(".modal")
            .forEach(
                function (modal) {

                    if (
                        !modal.classList.contains(
                            "hidden"
                        )
                    ) {

                        closeModal(
                            modal
                        );
                    }
                }
            );
    }
);


// ==================================================
// Rooms sidebar
// ==================================================

const roomsSidebar =
    document.getElementById(
        "rooms-sidebar"
    );


const roomsToggleButton =
    document.getElementById(
        "rooms-toggle-button"
    );


function setRoomsSidebarState(
    collapsed
) {

    if (!roomsSidebar) {
        return;
    }


    roomsSidebar.classList.toggle(
        "collapsed",
        collapsed
    );


    if (roomsToggleButton) {

        const label =
            collapsed
                ? "Развернуть список комнат"
                : "Свернуть список комнат";


        roomsToggleButton.setAttribute(
            "aria-label",
            label
        );


        roomsToggleButton.setAttribute(
            "title",
            label
        );
    }


    localStorage.setItem(
        "chatRoomsSidebarCollapsed",
        collapsed
            ? "true"
            : "false"
    );
}


if (
    roomsSidebar
    &&
    roomsToggleButton
) {

    const savedState =
        localStorage.getItem(
            "chatRoomsSidebarCollapsed"
        );


    if (savedState === "true") {

        setRoomsSidebarState(
            true
        );
    }


    roomsToggleButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();


            const collapsed =
                roomsSidebar.classList.contains(
                    "collapsed"
                );


            setRoomsSidebarState(
                !collapsed
            );
        }
    );
}
