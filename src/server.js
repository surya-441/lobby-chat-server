import express from "express";
import http from "http";
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

io.of("/game").on("connection", (socket) => {
    console.log("new user connected:", socket.id);

    socket.on("chat_message", (msg) => {
        console.log("message from", socket.id, ":", msg);
        io.of("/game").emit("chat_message", { from: socket.id, message: msg });
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
