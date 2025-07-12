import express from "express";
import http from "http";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

io.of("/game").on("connection", (socket) => {
    console.log("new user connected:", socket.id);

    socket.on("create_lobby", (maxPlayers, cb) => {
        console.log(`Create Lobby called with ${maxPlayers} players`);

        if (
            !Number.isInteger(maxPlayers) ||
            maxPlayers < 2 ||
            maxPlayers > 10
        ) {
            console.log("Create Lobby Failed");
            return cb?.({ error: "A lobby should have 2 to 10 players." });
        }

        const lobbyId = nanoid(6).toUpperCase();
        console.log(lobbyId);
        lobbies.set(lobbyId, {
            maxPlayers,
            participants: new Set([socket.id]),
        });

        socket.join(lobbyId);

        console.log(
            `Lobby ${lobbyId} created by ${socket.id} (max ${maxPlayers} players)`
        );

        cb({ lobbyId });
    });

    socket.on("join_lobby", (lobbyId, cb) => {
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
    });

    socket.on("chat_message", ({ lobbyId, text }) => {
        console.log("message from", socket.id, ":", text);
        io.of("/game")
            .to(lobbyId)
            .emit("chat_message", { from: socket.id, text: text });
    });

    socket.on("disconnecting", () => {
        for (const room of socket.rooms) {
            if (lobbies.has(room)) {
                const lobby = lobbies.get(room);

                if (!lobby) return;

                lobby.participants.delete(socket.id);

                if (lobby.participants.size === 0) {
                    lobbies.delete(room);

                    console.log(`Lobby ${room} deleted`);
                } else {
                    const participants = Array.from(lobby.participants);

                    io.of("/game").to(room).emit("participant_left", {
                        lobbyId: room,
                        participants,
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
