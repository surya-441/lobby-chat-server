import express from "express";
import http from "http";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getAIResponse } from "./ai.js";
import { botConfigs } from "./botConfig.js";
import { clearInterval } from "timers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(join(__dirname, "../public")));

app.get("/health", (req, res) => {
    res.send("OK");
});

const lobbies = new Map();
const intervals = {};

const getLobbyList = () => {
    const lobbyList = [];
    lobbies.forEach((value, key) => {
        if (!value.isPrivate)
            lobbyList.push({
                lobbyName: key,
                participantCount: value.participants.size,
                maxCount: value.maxPlayers,
            });
    });

    return lobbyList;
};

const processAIAnswer = async (lobbyId, text) => {
    const regex = /@ai([1-4])/gi;
    const array = text.match(regex) || [];
    const lowerCaseArray = array.map((m) => String(m).toLowerCase());
    const [ai_mention] = lowerCaseArray;

    if (!ai_mention) return;

    const idx = parseInt(ai_mention.replace("@ai", ""), 10) - 1;

    if (idx < 0 || idx > 1) return;

    console.log(`in ${lobbyId}, ${idx} AI was mentioned`);

    const aiResponse = await getAIResponse(botConfigs[idx].systemPrompt, text);
    console.log(aiResponse);

    io.of("/game").to(lobbyId).emit("chat_message", {
        from: botConfigs[idx].id,
        text: aiResponse,
    });
};

const broadcastLobbies = () => {
    const lobbyList = getLobbyList();
    io.of("/game").emit("lobby_list", lobbyList);
};

io.of("/game").on("connection", (socket) => {
    console.log("new user connected:", socket.id);

    socket.on("create_lobby", ({ maxPlayers, maxAI, isPrivate }, cb) => {
        console.log(
            `Create Lobby called with ${maxPlayers} players ${maxAI} ${isPrivate}`
        );

        if (
            !Number.isInteger(maxPlayers) ||
            maxPlayers < 2 ||
            maxPlayers > 10
        ) {
            console.log("Create Lobby Failed");
            return cb?.({ error: "A lobby should have 2 to 10 players." });
        }

        if (!Number.isInteger(maxAI) || maxAI < 0 || maxAI > 4) {
            console.log("Create Lobby Failed");
            return cb?.({ error: "A lobby should have 0 to 4 AI bots." });
        }
        const lobbyId = nanoid(6).toUpperCase();

        lobbies.set(lobbyId, {
            maxPlayers,
            maxAI,
            isPrivate,
            participants: new Set([socket.id]),
        });

        if (intervals[lobbyId]) clearInterval(intervals[lobbyId]);

        intervals[lobbyId] = setInterval(async () => {
            const idx = Math.floor(Math.random() * 2);
            const aiResponse = await getAIResponse(
                botConfigs[idx].systemPrompt,
                "Give a random trivia fact about AI Games. Do not add any other text other than the trivia fact."
            );
            console.log(aiResponse);

            io.of("/game").to(lobbyId).emit("chat_message", {
                from: botConfigs[idx].id,
                text: aiResponse,
            });
        }, 60_000);

        socket.join(lobbyId);

        console.log(
            `Lobby ${lobbyId} created by ${socket.id} (max ${maxPlayers} players)`
        );
        cb({ lobbyId });
        broadcastLobbies();
    });

    socket.on("join_lobby", ({ lobbyId }, cb) => {
        console.log(`Incoming lobbyId: ${lobbyId}`);
        const lobby = lobbies.get(lobbyId);

        lobbies.forEach((value, key) => {
            console.log(`Key: ${key}, Value: ${value}`);
        });

        if (!lobby) {
            return cb({ error: "Lobby not found" });
        }

        if (lobby.participants.size == lobby.maxPlayers) {
            return cb?.({ error: "Lobby is full" });
        }

        lobby.participants.add(socket.id);
        socket.join(lobbyId);

        console.log(`${socket.id} joined lobby ${lobbyId}`);

        const participants = Array.from(lobby.participants);
        cb({ lobbyId, participants });

        io.of("/game").to(lobbyId).emit("lobby_joined", {
            lobbyId,
            participants,
        });
        broadcastLobbies();
    });

    socket.on("chat_message", ({ lobbyId, text }) => {
        console.log("message from", socket.id, ":", text);

        processAIAnswer(lobbyId, text);

        socket
            .to(lobbyId)
            .emit("chat_message", { from: socket.id, text: text });
    });

    socket.on("get_lobbies", () => {
        const lobbyList = getLobbyList();
        socket.emit("lobby_list", lobbyList);
    });

    socket.on("disconnecting", () => {
        for (const room of socket.rooms) {
            if (lobbies.has(room)) {
                const lobby = lobbies.get(room);

                if (!lobby) return;

                if (!lobby.participants.has(socket.id.toString())) {
                    continue;
                }

                lobby.participants.delete(socket.id);

                if (lobby.participants.size === 0) {
                    lobbies.delete(room);
                    clearInterval(intervals[room]);
                    console.log(`Lobby ${room} deleted`);
                } else {
                    io.of("/game").to(room).emit("participant_left", {
                        leavingParticipant: socket.id.toString(),
                    });
                }
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("user disconnected:", socket.id);
    });
});

app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "../public", "test-socket.html"));
});

const PORT = 3000;

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
