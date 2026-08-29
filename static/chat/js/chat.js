const roomName = chatConfig.roomName;
let chatSocket = null;
let reconnectTimer = null;
let shouldReconnect = true;

const isAuthenticated = chatConfig.isAuthenticated;


// =========================
// DOM elements
// =========================

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

const chatMessageInput =
    document.getElementById("chat-message-input");

const chatMessageSubmit =
    document.getElementById("chat-message-submit");


// =========================
// User Menu
// =========================

const userMenuButton =
    document.getElementById("user-menu-button");

const userMenuDropdown =
    document.getElementById("user-menu-dropdown");

const logoutButton =
    document.getElementById("logout-button");


// =========================
// Room Menu
// =========================

const roomMenuButton =
    document.getElementById("room-menu-button");

const roomMenuDropdown =
    document.getElementById("room-menu-dropdown");


// =========================
// Room Management
// =========================

const createRoomButton =
    document.getElementById("create-room-button");

const createRoomModal =
    document.getElementById("create-room-modal");

const createRoomForm =
    document.getElementById("create-room-form");

const createRoomError =
    document.getElementById("create-room-error");

const addMemberButton =
    document.getElementById("add-member-button");

const addMemberModal =
    document.getElementById("add-member-modal");

const addMemberForm =
    document.getElementById("add-member-form");

const addMemberError =
    document.getElementById("add-member-error");

const editRoomButton =
    document.getElementById("edit-room-button");

const editRoomModal =
    document.getElementById("edit-room-modal");

const editRoomForm =
    document.getElementById("edit-room-form");

const editRoomError =
    document.getElementById("edit-room-error");

const leaveRoomButton =
    document.getElementById("leave-room-button");

const joinRoomButton =
    document.getElementById("join-room-button");


// =========================
// Rooms Sidebar
// =========================

const roomsSidebar =
    document.getElementById("rooms-sidebar");

const roomsToggleButton =
    document.getElementById("rooms-toggle-button");


// =========================
// WebSocket
// =========================

if (isAuthenticated) {
    connectWebSocket();
}


function connectWebSocket() {

    if (!isAuthenticated) {
        return;
    }

    if (
        chatSocket &&
        (
            chatSocket.readyState === WebSocket.OPEN ||
            chatSocket.readyState === WebSocket.CONNECTING
        )
    ) {
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


    chatSocket.onopen = function () {

        console.log(
            "WebSocket connection established"
        );
    };


    chatSocket.onmessage = function (event) {

        const data =
            JSON.parse(event.data);


        if (data.type === "history") {

            data.messages.forEach(addMessage);

            scrollToBottom(false);

            return;
        }


        if (data.type === "message") {

            addMessage(data);

            scrollToBottom(true);

            return;
        }


        if (data.type === "error") {

            showError(data.message);

            return;
        }


        if (data.type === "online_users") {

            updateOnlineUsers(data.users);

            return;
        }


        if (data.type === "user_status") {

            showSystemMessage(
                data.username,
                data.action
            );

            scrollToBottom(true);
        }
    };


    chatSocket.onerror = function (error) {

        console.error(
            "WebSocket error:",
            error
        );
    };


    chatSocket.onclose = function () {

        console.log(
            "WebSocket connection closed"
        );

        chatSocket = null;

        if (!shouldReconnect) {
            return;
        }

        if (reconnectTimer) {
            return;
        }

        reconnectTimer =
            setTimeout(
                function () {

                    reconnectTimer = null;

                    connectWebSocket();
                },
                3000
            );
    };
}


// =========================
// Online users
// =========================

function updateOnlineUsers(users) {

    const onlineUsers =
        new Set(users);

    const members =
        document.querySelectorAll(
            ".room-member"
        );


    members.forEach(
        function (member) {

            const username =
                member.dataset.username;

            const status =
                member.querySelector(
                    ".participant-status"
                );


            if (!status) {
                return;
            }


            if (onlineUsers.has(username)) {

                status.classList.add(
                    "online"
                );

            } else {

                status.classList.remove(
                    "online"
                );
            }
        }
    );
}


// =========================
// Messages
// =========================

function addMessage(data) {

    if (!chatLog) {
        return;
    }


    const messageElement =
        document.createElement("div");


    const currentUser =
        chatConfig.username;


    if (data.username === currentUser) {

        messageElement.classList.add(
            "message",
            "own"
        );

    } else {

        messageElement.classList.add(
            "message"
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
        document.createElement("span");

    avatar.classList.add(
        "message-avatar"
    );


    if (data.avatar) {

        const avatarImage =
            document.createElement("img");


        avatarImage.src =
            data.avatar;

        avatarImage.alt =
            `Аватар ${data.username}`;


        avatar.appendChild(
            avatarImage
        );

    } else {

        avatar.textContent =
            data.username
                .charAt(0)
                .toUpperCase();
    }


    const usernameText =
        document.createElement("span");


    usernameText.textContent =
        data.username;


    username.appendChild(
        avatar
    );

    username.appendChild(
        usernameText
    );


    const text =
        document.createElement("div");

    text.classList.add(
        "text"
    );


    text.textContent =
        data.message;


    const time =
        document.createElement("div");

    time.classList.add(
        "time"
    );


    const date =
        new Date(data.created_at);


    time.textContent =
        date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );


    content.appendChild(
        username
    );

    content.appendChild(
        text
    );

    content.appendChild(
        time
    );


    messageElement.appendChild(
        content
    );


    chatLog.appendChild(
        messageElement
    );
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


    chatLog.appendChild(
        element
    );
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
            behavior: "smooth"
        });

    } else {

        chatLog.scrollTop =
            chatLog.scrollHeight;
    }
}


function showError(message) {

    const errorElement =
        document.getElementById(
            "login-error"
        )
        ||
        document.getElementById(
            "register-error"
        );


    if (!errorElement) {
        return;
    }


    errorElement.textContent =
        message;


    setTimeout(
        function () {

            errorElement.textContent = "";

        },
        4000
    );
}


// =========================
// Send message
// =========================

function sendMessage() {

    if (!chatMessageInput) {
        return;
    }


    const message =
        chatMessageInput.value.trim();


    if (!message) {
        return;
    }


    if (
        !chatSocket ||
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
            message: message
        })
    );


    chatMessageInput.value = "";

    chatMessageInput.focus();
}


if (chatMessageSubmit) {

    chatMessageSubmit.addEventListener(
        "click",
        sendMessage
    );
}


if (chatMessageInput) {

    chatMessageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


// =========================
// Auth
// =========================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

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


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                errorElement.textContent =
                    "Не удалось получить CSRF-токен.";

                return;
            }


            errorElement.textContent =
                "Выполняется вход...";


            try {

                const response =
                    await fetch(
                        chatConfig.loginUrl,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "X-CSRFToken":
                                    csrfToken,
                            },

                            body:
                                new URLSearchParams({
                                    username,
                                    password
                                }),
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    errorElement.textContent =
                        data.error ||
                        "Ошибка входа";

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
    );
}


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function (event) {

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


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                errorElement.textContent =
                    "Не удалось получить CSRF-токен.";

                return;
            }


            errorElement.textContent =
                "Создание аккаунта...";


            try {

                const response =
                    await fetch(
                        chatConfig.registerUrl,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "X-CSRFToken":
                                    csrfToken,
                            },

                            body:
                                new URLSearchParams({
                                    username,
                                    email,
                                    password,
                                    password_confirm:
                                        passwordConfirm
                                }),
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    showRegistrationErrors(
                        data.errors ||
                        {
                            general: [
                                "Ошибка регистрации"
                            ]
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
    );
}


function showRegistrationErrors(
    errors
) {

    const errorElement =
        document.getElementById(
            "register-error"
        );


    if (!errorElement) {
        return;
    }


    const messages = [];


    for (
        const field in errors
    ) {

        const fieldErrors =
            errors[field];


        if (
            Array.isArray(fieldErrors)
        ) {

            fieldErrors.forEach(
                function (error) {

                    messages.push(
                        typeof error === "object"
                            ? error.message
                            : error
                    );
                }
            );

        } else {

            messages.push(
                fieldErrors
            );
        }
    }


    errorElement.textContent =
        messages.join(" • ");
}


// =========================
// Auth modal switching
// =========================

if (showRegisterButton) {

    showRegisterButton.addEventListener(
        "click",
        function () {

            if (loginContainer) {

                loginContainer.classList.add(
                    "hidden"
                );
            }


            if (registerContainer) {

                registerContainer.classList.remove(
                    "hidden"
                );
            }


            clearElementError(
                "register-error"
            );
        }
    );
}


if (showLoginButton) {

    showLoginButton.addEventListener(
        "click",
        function () {

            if (registerContainer) {

                registerContainer.classList.add(
                    "hidden"
                );
            }


            if (loginContainer) {

                loginContainer.classList.remove(
                    "hidden"
                );
            }


            clearElementError(
                "login-error"
            );
        }
    );
}


// =========================
// User Menu
// =========================

if (userMenuButton) {

    userMenuButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();


            if (roomMenuDropdown) {

                roomMenuDropdown.classList.add(
                    "hidden"
                );
            }


            if (userMenuDropdown) {

                userMenuDropdown.classList.toggle(
                    "hidden"
                );
            }
        }
    );
}


// =========================
// Room Menu
// =========================

if (roomMenuButton) {

    roomMenuButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();


            if (userMenuDropdown) {

                userMenuDropdown.classList.add(
                    "hidden"
                );
            }


            if (roomMenuDropdown) {

                roomMenuDropdown.classList.toggle(
                    "hidden"
                );
            }
        }
    );
}


// =========================
// Close menus on document click
// =========================

document.addEventListener(
    "click",
    function () {

        if (userMenuDropdown) {

            userMenuDropdown.classList.add(
                "hidden"
            );
        }


        if (roomMenuDropdown) {

            roomMenuDropdown.classList.add(
                "hidden"
            );
        }
    }
);


// Prevent clicks inside dropdowns
// from bubbling to document.

if (userMenuDropdown) {

    userMenuDropdown.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();
        }
    );
}


if (roomMenuDropdown) {

    roomMenuDropdown.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();
        }
    );
}


// =========================
// Logout
// =========================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function () {

            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                alert(
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            shouldReconnect = false;


            if (reconnectTimer) {

                clearTimeout(
                    reconnectTimer
                );

                reconnectTimer = null;
            }


            if (chatSocket) {

                chatSocket.onclose = null;

                chatSocket.close();

                chatSocket = null;
            }


            try {

                const response =
                    await fetch(
                        chatConfig.logoutUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },
                        }
                    );


                if (response.ok) {

                    window.location.reload();

                    return;
                }


                alert(
                    "Не удалось выполнить выход."
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    "Ошибка сети. Попробуйте позже."
                );
            }
        }
    );
}


// =========================
// Edit Room
// =========================

if (editRoomButton) {

    editRoomButton.addEventListener(
        "click",
        function () {

            if (roomMenuDropdown) {

                roomMenuDropdown.classList.add(
                    "hidden"
                );
            }


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
        async function (event) {

            event.preventDefault();


            clearModalError(
                editRoomError
            );


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                showModalError(
                    editRoomError,
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            const formData =
                new FormData(
                    editRoomForm
                );


            const submitButton =
                editRoomForm.querySelector(
                    "button[type=submit]"
                );


            setSubmitButtonState(
                submitButton,
                true,
                "Сохранение..."
            );


            try {

                const response =
                    await fetch(
                        chatConfig.updateRoomUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },

                            body: formData,
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    showModalError(
                        editRoomError,
                        extractFormErrors(
                            data.errors
                        ) ||
                        data.error ||
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

                setSubmitButtonState(
                    submitButton,
                    false,
                    "Сохранить"
                );
            }
        }
    );
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
            room.description ||
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


        element.appendChild(
            image
        );

    } else {

        element.textContent =
            room.name
                .charAt(0)
                .toUpperCase();
    }
}


// =========================
// Remove Room Member
// =========================

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


    const csrfToken =
        getCsrfToken();


    if (!csrfToken) {

        alert(
            "Не удалось получить CSRF-токен."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `/chat/rooms/${chatConfig.roomId}/members/${userId}/remove/`,
                {
                    method: "POST",

                    headers: {
                        "X-CSRFToken":
                            csrfToken,
                    },
                }
            );


        const data =
            await parseJsonResponse(
                response
            );


        if (!response.ok) {

            alert(
                data.error ||
                "Не удалось удалить участника."
            );

            return;
        }


        if (element) {

            element.remove();
        }


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


// =========================
// Leave Room
// =========================

if (leaveRoomButton) {

    leaveRoomButton.addEventListener(
        "click",
        async function () {

            const confirmed =
                confirm(
                    "Вы действительно хотите покинуть этот чат?"
                );


            if (!confirmed) {
                return;
            }


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                alert(
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            leaveRoomButton.disabled =
                true;

            leaveRoomButton.textContent =
                "Выход...";


            try {

                const response =
                    await fetch(
                        chatConfig.leaveRoomUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    alert(
                        data.error ||
                        "Не удалось покинуть чат."
                    );

                    return;
                }


                shouldReconnect = false;


                if (reconnectTimer) {

                    clearTimeout(
                        reconnectTimer
                    );

                    reconnectTimer = null;
                }


                if (chatSocket) {

                    chatSocket.onclose = null;

                    chatSocket.close();

                    chatSocket = null;
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

                leaveRoomButton.disabled =
                    false;

                leaveRoomButton.textContent =
                    "🚪 Покинуть чат";
            }
        }
    );
}


// =========================
// Join Room
// =========================

if (joinRoomButton) {

    joinRoomButton.addEventListener(
        "click",
        async function () {

            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                alert(
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            joinRoomButton.disabled =
                true;

            joinRoomButton.textContent =
                "Вступление...";


            try {

                const response =
                    await fetch(
                        chatConfig.joinRoomUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


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

                joinRoomButton.disabled =
                    false;

                joinRoomButton.textContent =
                    "Вступить в комнату";
            }
        }
    );
}


// =========================
// Add Member
// =========================

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
        async function (event) {

            event.preventDefault();


            clearModalError(
                addMemberError
            );


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                showModalError(
                    addMemberError,
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            const formData =
                new FormData(
                    addMemberForm
                );


            const submitButton =
                addMemberForm.querySelector(
                    "button[type=submit]"
                );


            setSubmitButtonState(
                submitButton,
                true,
                "Добавление..."
            );


            try {

                const response =
                    await fetch(
                        chatConfig.addMemberUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },

                            body: formData,
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    showModalError(
                        addMemberError,
                        extractFormErrors(
                            data.errors
                        ) ||
                        data.error ||
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

                setSubmitButtonState(
                    submitButton,
                    false,
                    "Добавить"
                );
            }
        }
    );
}


// =========================
// Create Room
// =========================

if (createRoomButton) {

    createRoomButton.addEventListener(
        "click",
        function () {

            if (createRoomForm) {

                createRoomForm.reset();
            }


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
        async function (event) {

            event.preventDefault();


            clearModalError(
                createRoomError
            );


            const csrfToken =
                getCsrfToken();


            if (!csrfToken) {

                showModalError(
                    createRoomError,
                    "Не удалось получить CSRF-токен."
                );

                return;
            }


            const formData =
                new FormData(
                    createRoomForm
                );


            const submitButton =
                createRoomForm.querySelector(
                    "button[type=submit]"
                );


            setSubmitButtonState(
                submitButton,
                true,
                "Создание..."
            );


            try {

                const response =
                    await fetch(
                        chatConfig.createRoomUrl,
                        {
                            method: "POST",

                            headers: {
                                "X-CSRFToken":
                                    csrfToken,
                            },

                            body: formData,
                        }
                    );


                const data =
                    await parseJsonResponse(
                        response
                    );


                if (!response.ok) {

                    showModalError(
                        createRoomError,
                        extractFormErrors(
                            data.errors
                        ) ||
                        data.error ||
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

                setSubmitButtonState(
                    submitButton,
                    false,
                    "Создать"
                );
            }
        }
    );
}


// =========================
// Modal helpers
// =========================

function openModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );
}


function closeModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );
}


function showModalError(
    element,
    message
) {

    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.classList.remove(
        "hidden"
    );
}


function clearModalError(
    element
) {

    if (!element) {
        return;
    }


    element.textContent = "";


    element.classList.add(
        "hidden"
    );
}


function clearElementError(
    elementId
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.textContent = "";
}


// =========================
// Form helpers
// =========================

function getCsrfToken() {

    const tokenElement =
        document.querySelector(
            "[name=csrfmiddlewaretoken]"
        );


    return tokenElement
        ? tokenElement.value
        : null;
}


async function parseJsonResponse(
    response
) {

    try {

        return await response.json();

    } catch (error) {

        return {};
    }
}


function setSubmitButtonState(
    button,
    disabled,
    text
) {

    if (!button) {
        return;
    }


    button.disabled =
        disabled;

    button.textContent =
        text;
}


// =========================
// Form errors
// =========================

function extractFormErrors(
    errors
) {

    if (!errors) {
        return "";
    }


    const messages = [];


    for (
        const field in errors
    ) {

        const fieldErrors =
            errors[field];


        if (
            Array.isArray(fieldErrors)
        ) {

            fieldErrors.forEach(
                function (error) {

                    messages.push(
                        typeof error === "object"
                            ? error.message
                            : error
                    );
                }
            );

        } else {

            messages.push(
                fieldErrors
            );
        }
    }


    return messages.join(
        " • "
    );
}


// =========================
// Add member to menu
// =========================

function addMemberToMenu(
    member
) {

    const list =
        document.getElementById(
            "room-members-list"
        );


    if (!list) {
        return;
    }


    const element =
        document.createElement(
            "div"
        );


    element.classList.add(
        "room-member"
    );


    element.dataset.userId =
        member.id;

    element.dataset.username =
        member.username;


    const avatar =
        document.createElement(
            "div"
        );


    avatar.classList.add(
        "room-member-avatar"
    );


    if (member.avatar) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            member.avatar;

        image.alt =
            member.username;


        avatar.appendChild(
            image
        );

    } else {

        avatar.textContent =
            member.username
                .charAt(0)
                .toUpperCase();
    }


    const status =
        document.createElement(
            "span"
        );


    status.classList.add(
        "participant-status"
    );


    const username =
        document.createElement(
            "span"
        );


    username.classList.add(
        "room-member-name"
    );


    username.textContent =
        member.username;


    element.appendChild(
        avatar
    );

    element.appendChild(
        status
    );

    element.appendChild(
        username
    );


    if (
        chatConfig.isRoomOwner
    ) {

        const removeButton =
            document.createElement(
                "button"
            );


        removeButton.type =
            "button";

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
            function (event) {

                event.stopPropagation();


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


// =========================
// Remove user from select
// =========================

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


    if (option) {

        option.remove();
    }
}


// =========================
// Update member count
// =========================

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


// =========================
// Close modals
// =========================

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
    .querySelectorAll(
        ".modal"
    )
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
            .querySelectorAll(
                ".modal"
            )
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


// =========================
// Rooms Sidebar
// =========================

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

        roomsToggleButton.setAttribute(
            "aria-label",
            collapsed
                ? "Развернуть список комнат"
                : "Свернуть список комнат"
        );


        roomsToggleButton.setAttribute(
            "title",
            collapsed
                ? "Развернуть список комнат"
                : "Свернуть список комнат"
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
    roomsSidebar &&
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
