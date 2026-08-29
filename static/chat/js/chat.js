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

    const protocol =
        window.location.protocol === "https:"
            ? "wss:"
            : "ws:";

    chatSocket = new WebSocket(
        `${protocol}//${window.location.host}/ws/chat/${encodeURIComponent(roomName)}/`
    );


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

            showSystemMessage(
                data.username,
                data.action
            );

            scrollToBottom(true);
        }
    };


    chatSocket.onclose = function () {

        console.log(
            "WebSocket connection closed"
        );

        setTimeout(
            connectWebSocket,
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


        if (onlineUsers.has(username)) {

            status.classList.add(
                "online"
            );

            status.title =
                "Онлайн";

        } else {

            status.classList.remove(
                "online"
            );

            status.title =
                "Оффлайн";
        }
    });
}


// =========================
// Messages
// =========================

function addMessage(data) {

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
                minute: "2-digit"
            }
        );


    content.appendChild(username);
    content.appendChild(text);
    content.appendChild(time);

    messageElement.appendChild(content);

    chatLog.appendChild(
        messageElement
    );
}


function showSystemMessage(
    username,
    action
) {

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
    }


    chatLog.appendChild(element);
}


function scrollToBottom(
    smooth = true
) {

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


    if (errorElement) {

        errorElement.textContent =
            message;


        setTimeout(function () {

            errorElement.textContent = "";

        }, 4000);
    }
}


// =========================
// Send message
// =========================

function sendMessage() {

    const input =
        document.getElementById(
            "chat-message-input"
        );

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
            message: message
        })
    );


    input.value = "";

    input.focus();
}


document
    .getElementById("chat-message-submit")
    .addEventListener(
        "click",
        sendMessage
    );


document
    .getElementById("chat-message-input")
    .addEventListener(
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


// =========================
// Auth & UI Logic
// =========================

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
            document.querySelector(
                "[name=csrfmiddlewaretoken]"
            ).value;


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
                await response.json();


            if (!response.ok) {

                errorElement.textContent =
                    data.error
                    ||
                    "Ошибка входа";

                return;
            }


            window.location.reload();

        } catch (err) {

            errorElement.textContent =
                "Ошибка сети. Попробуйте позже.";
        }
    }
);


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
            document.querySelector(
                "[name=csrfmiddlewaretoken]"
            ).value;


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
                await response.json();


            if (!response.ok) {

                showRegistrationErrors(
                    data.errors
                    ||
                    {
                        general: [
                            "Ошибка регистрации"
                        ]
                    }
                );

                return;
            }


            window.location.reload();

        } catch (err) {

            errorElement.textContent =
                "Ошибка сети. Попробуйте позже.";
        }
    }
);


function showRegistrationErrors(
    errors
) {

    const errorElement =
        document.getElementById(
            "register-error"
        );


    const messages = [];


    for (
        const field in errors
    ) {

        if (
            Array.isArray(
                errors[field]
            )
        ) {

            errors[field].forEach(
                function (err) {

                    messages.push(
                        typeof err === "object"
                            ? err.message
                            : err
                    );
                }
            );

        } else {

            messages.push(
                errors[field]
            );
        }
    }


    errorElement.textContent =
        messages.join(" • ");
}


// =========================
// Auth modal switching
// =========================

showRegisterButton.addEventListener(
    "click",
    function () {

        loginContainer.classList.add(
            "hidden"
        );

        registerContainer.classList.remove(
            "hidden"
        );


        document.getElementById(
            "register-error"
        ).textContent = "";
    }
);


showLoginButton.addEventListener(
    "click",
    function () {

        registerContainer.classList.add(
            "hidden"
        );

        loginContainer.classList.remove(
            "hidden"
        );


        document.getElementById(
            "login-error"
        ).textContent = "";
    }
);


// =========================
// User Menu & Logout
// =========================

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

            userMenuDropdown.classList.toggle(
                "hidden"
            );
        }
    );
}


document.addEventListener(
    "click",
    function () {

        if (userMenuDropdown) {

            userMenuDropdown.classList.add(
                "hidden"
            );
        }
    }
);


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function () {

            const csrfToken =
                document.querySelector(
                    "[name=csrfmiddlewaretoken]"
                ).value;


            if (chatSocket) {
                chatSocket.close();
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
                }

            } catch (err) {

                console.error(
                    "Logout error:",
                    err
                );
            }
        }
    );
}


// =========================
// Room Management
// =========================

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


// =========================
// Create room modal
// =========================

if (createRoomButton) {

    createRoomButton.addEventListener(
        "click",
        function () {

            createRoomForm.reset();

            clearModalError(
                createRoomError
            );

            openModal(
                createRoomModal
            );
        }
    );
}


// =========================
// Add member modal
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


// =========================
// Create room
// =========================

if (createRoomForm) {

    createRoomForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            clearModalError(
                createRoomError
            );


            const csrfToken =
                createRoomForm.querySelector(
                    "[name=csrfmiddlewaretoken]"
                ).value;


            const formData =
                new FormData(
                    createRoomForm
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

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "Создать";
            }
        }
    );
}


// =========================
// Add member
// =========================

if (addMemberForm) {

    addMemberForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            clearModalError(
                addMemberError
            );


            const csrfToken =
                addMemberForm.querySelector(
                    "[name=csrfmiddlewaretoken]"
                ).value;


            const formData =
                new FormData(
                    addMemberForm
                );


            const submitButton =
                addMemberForm.querySelector(
                    "button[type=submit]"
                );


            submitButton.disabled =
                true;

            submitButton.textContent =
                "Добавление...";


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

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "Добавить";
            }
        }
    );
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
            Array.isArray(
                fieldErrors
            )
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


    const username =
        document.createElement(
            "span"
        );


    username.classList.add(
        "room-member-name"
    );


    username.textContent =
        member.username;


    const status =
        document.createElement(
            "span"
        );


    status.classList.add(
        "participant-status"
    );


    status.dataset.username =
        member.username;

    status.title =
        "Оффлайн";


    element.appendChild(
        avatar
    );


    element.appendChild(
        username
    );


    element.appendChild(
        status
    );


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