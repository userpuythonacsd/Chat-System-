/* =========================================================
   SECURECHAT
   Frontend:
   HTML + CSS + JavaScript

   Backend:
   Supabase Auth + PostgreSQL + Realtime
========================================================= */


/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL =
    "https://ngwttthtycpoiibzkoto.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_p0eah379CsV3EVPXNg8ncw_qgd4ax91";


const {
    createClient
} = window.supabase;


const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);


/* =========================================================
   DOM
========================================================= */

const authScreen =
    document.getElementById("authScreen");

const chatScreen =
    document.getElementById("chatScreen");

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const forgotPassword =
    document.getElementById("forgotPassword");

const logoutButton =
    document.getElementById("logoutButton");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const messagesContainer =
    document.getElementById("messages");

const authMessage =
    document.getElementById("authMessage");

const chatStatus =
    document.getElementById("chatStatus");

const currentUserElement =
    document.getElementById("currentUser");


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let currentProfile = null;
let realtimeChannel = null;


/* =========================================================
   SECURITY HELPERS
========================================================= */

function cleanUsername(username) {

    return username
        .trim()
        .replace(/[^A-Za-z0-9_]/g, "")
        .slice(0, 20);

}


function cleanMessage(message) {

    return message
        .trim()
        .slice(0, 1000);

}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;

}


function formatTime(timestamp) {

    return new Date(timestamp)
        .toLocaleString();

}


function setAuthMessage(message) {

    authMessage.textContent = message;

}


function setChatStatus(message) {

    chatStatus.textContent = message;

}


/* =========================================================
   UI
========================================================= */

function showAuth() {

    authScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");

}


function showChat() {

    authScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

}


/* =========================================================
   REGISTER
========================================================= */

registerForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        setAuthMessage("Creating account...");

        const username =
            cleanUsername(
                document.getElementById(
                    "registerUsername"
                ).value
            );

        const email =
            document.getElementById(
                "registerEmail"
            ).value
            .trim()
            .toLowerCase();

        const password =
            document.getElementById(
                "registerPassword"
            ).value;


        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {

            setAuthMessage(
                "Username must contain only letters, numbers and underscores."
            );

            return;
        }


        if (password.length < 8) {

            setAuthMessage(
                "Password must contain at least 8 characters."
            );

            return;
        }


        const {
            data,
            error
        } = await supabaseClient.auth.signUp({

            email,

            password,

            options: {

                data: {
                    username
                },

                emailRedirectTo:
                    window.location.origin +
                    window.location.pathname

            }

        });


        if (error) {

            setAuthMessage(
                error.message
            );

            return;
        }


        if (data.session) {

            setAuthMessage(
                "Account created."
            );

        } else {

            setAuthMessage(
                "Account created. Check your email and verify your account before logging in."
            );

        }

        registerForm.reset();

    }
);


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        setAuthMessage("Signing in...");


        const email =
            document.getElementById(
                "loginEmail"
            ).value
            .trim()
            .toLowerCase();

        const password =
            document.getElementById(
                "loginPassword"
            ).value;


        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({

                    email,
                    password

                });


        if (error) {

            setAuthMessage(
                error.message
            );

            return;
        }


        currentUser =
            data.user;


        await startChat();

    }
);


/* =========================================================
   PASSWORD RESET
========================================================= */

forgotPassword.addEventListener(
    "click",
    async function() {

        const email =
            document.getElementById(
                "loginEmail"
            ).value
            .trim()
            .toLowerCase();


        if (!email) {

            setAuthMessage(
                "Enter your email address first."
            );

            return;
        }


        const {
            error
        } =
            await supabaseClient.auth
                .resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            window.location.origin +
                            window.location.pathname
                    }
                );


        if (error) {

            setAuthMessage(
                error.message
            );

            return;
        }


        setAuthMessage(
            "If the account exists, a password reset email has been sent."
        );

    }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
    "click",
    async function() {

        await stopRealtime();

        const {
            error
        } =
            await supabaseClient.auth.signOut();


        if (error) {

            console.error(error);

            return;
        }


        currentUser = null;
        currentProfile = null;

        messagesContainer.innerHTML = "";

        showAuth();

    }
);


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    if (!currentUser) {
        return false;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("id, username")
            .eq("id", currentUser.id)
            .single();


    if (error) {

        console.error(error);

        setChatStatus(
            "Unable to load your profile."
        );

        return false;
    }


    currentProfile = data;

    currentUserElement.textContent =
        "@" + currentProfile.username;


    return true;

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

    setChatStatus(
        "Loading messages..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select(`
                id,
                user_id,
                content,
                created_at,
                profiles (
                    username
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(100);


    if (error) {

        console.error(error);

        setChatStatus(
            "Unable to load messages."
        );

        return;
    }


    messagesContainer.innerHTML = "";


    const orderedMessages =
        data.reverse();


    for (const message
        of orderedMessages) {

        renderMessage(message);

    }


    scrollToBottom();

    setChatStatus("");

}


/* =========================================================
   RENDER MESSAGE
========================================================= */

function renderMessage(message) {

    if (
        document.querySelector(
            `[data-message-id="${message.id}"]`
        )
    ) {

        return;

    }


    const wrapper =
        document.createElement("article");


    wrapper.className =
        "message";


    if (
        currentUser &&
        message.user_id === currentUser.id
    ) {

        wrapper.classList.add("mine");

    }


    wrapper.dataset.messageId =
        message.id;


    const username =
        message.profiles?.username ||
        "User";


    const safeUsername =
        escapeHTML(username);

    const safeContent =
        escapeHTML(message.content);


    wrapper.innerHTML = `

        <div class="message-user">
            ${safeUsername}
        </div>

        <div class="message-content">
            ${safeContent}
        </div>

        <div class="message-time">
            ${escapeHTML(
                formatTime(message.created_at)
            )}
        </div>

    `;


    if (
        currentUser &&
        message.user_id === currentUser.id
    ) {

        const deleteButton =
            document.createElement("button");


        deleteButton.className =
            "delete-message";

        deleteButton.type =
            "button";

        deleteButton.textContent =
            "Delete";


        deleteButton.addEventListener(
            "click",
            function() {

                deleteMessage(
                    message.id
                );

            }
        );


        wrapper.appendChild(
            deleteButton
        );

    }


    messagesContainer.appendChild(
        wrapper
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

messageForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        if (!currentUser) {

            return;

        }


        const content =
            cleanMessage(
                messageInput.value
            );


        if (!content) {

            return;

        }


        messageInput.disabled = true;


        const {
            error
        } =
            await supabaseClient
                .from("messages")
                .insert({

                    user_id:
                        currentUser.id,

                    content

                });


        messageInput.disabled = false;


        if (error) {

            setChatStatus(
                error.message
            );

            return;
        }


        messageInput.value = "";

        messageInput.focus();

    }
);


/* =========================================================
   DELETE MESSAGE
========================================================= */

async function deleteMessage(id) {

    const confirmed =
        window.confirm(
            "Delete this message?"
        );


    if (!confirmed) {

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("messages")
            .delete()
            .eq("id", id);


    if (error) {

        console.error(error);

        setChatStatus(
            "Unable to delete message."
        );

    }

}


/* =========================================================
   REALTIME
========================================================= */

async function startRealtime() {

    await stopRealtime();


    realtimeChannel =
        supabaseClient
            .channel(
                "public-messages"
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                async function(payload) {

                    await handleNewMessage(
                        payload.new
                    );

                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "messages"
                },
                function(payload) {

                    removeMessage(
                        payload.old.id
                    );

                }
            )
            .subscribe(
                function(status) {

                    if (
                        status === "SUBSCRIBED"
                    ) {

                        setChatStatus(
                            "Realtime connected."
                        );

                        setTimeout(
                            function() {

                                setChatStatus("");

                            },
                            1500
                        );

                    }


                    if (
                        status === "CHANNEL_ERROR"
                    ) {

                        setChatStatus(
                            "Realtime connection error."
                        );

                    }

                }
            );

}


/* =========================================================
   HANDLE REALTIME INSERT
========================================================= */

async function handleNewMessage(
    newMessage
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select(`
                id,
                user_id,
                content,
                created_at,
                profiles (
                    username
                )
            `)
            .eq(
                "id",
                newMessage.id
            )
            .single();


    if (error) {

        console.error(error);

        return;

    }


    renderMessage(data);

    scrollToBottom();

}


/* =========================================================
   REMOVE MESSAGE
========================================================= */

function removeMessage(id) {

    const element =
        document.querySelector(
            `[data-message-id="${id}"]`
        );


    if (element) {

        element.remove();

    }

}


/* =========================================================
   STOP REALTIME
========================================================= */

async function stopRealtime() {

    if (!realtimeChannel) {

        return;

    }


    await supabaseClient
        .removeChannel(
            realtimeChannel
        );


    realtimeChannel = null;

}


/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}


/* =========================================================
   START CHAT
========================================================= */

async function startChat() {

    showChat();


    const profileLoaded =
        await loadProfile();


    if (!profileLoaded) {

        return;

    }


    await loadMessages();

    await startRealtime();

}


/* =========================================================
   AUTH STATE
========================================================= */

supabaseClient.auth.onAuthStateChange(
    async function(event, session) {

        if (session?.user) {

            currentUser =
                session.user;

            await startChat();

        } else {

            currentUser = null;
            currentProfile = null;

            await stopRealtime();

            showAuth();

        }

    }
);


/* =========================================================
   INITIAL SESSION
========================================================= */

async function initialize() {

    const {
        data,
        error
    } =
        await supabaseClient.auth
            .getSession();


    if (error) {

        console.error(error);

        showAuth();

        return;

    }


    if (data.session?.user) {

        currentUser =
            data.session.user;

        await startChat();

    } else {

        showAuth();

    }

}


initialize();
