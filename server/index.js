const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./rooms");
const { getHistory, addOperation, undo, redo, clearRoom } = require("./drawing-state");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    socket.on("join_room", (data) => {
        try {
            const { username, roomId } = data;
            if (!username || !roomId) return;

            socket.join(roomId);

            const user = userJoin(socket.id, username, roomId);
            const history = getHistory(roomId);

            socket.emit("init_state", history);
            io.to(roomId).emit("user_update", getRoomUsers(roomId));
        } catch (err) { }
    });

    socket.on("draw_op", (data) => {
        try {
            const user = getCurrentUser(socket.id);
            if (!user) return;

            const operation = {
                ...data,
                id: Date.now() + Math.random(),
                userId: user.id,
                username: user.username
            };

            addOperation(user.roomId, operation);
            io.to(user.roomId).emit("new_op", operation);
        } catch (err) { }
    });

    socket.on("draw_step", (data) => {
        try {
            const user = getCurrentUser(socket.id);
            if (!user) return;
            socket.to(user.roomId).emit("draw_step", { ...data, userId: user.id });
        } catch (err) { }
    });

    socket.on("undo", () => {
        try {
            const user = getCurrentUser(socket.id);
            if (!user) return;

            const undoneOp = undo(user.roomId);
            if (undoneOp) {
                io.to(user.roomId).emit("undo_op", undoneOp.id);
            }
        } catch (err) { }
    });

    socket.on("redo", () => {
        try {
            const user = getCurrentUser(socket.id);
            if (!user) return;

            const redoneOp = redo(user.roomId);
            if (redoneOp) {
                io.to(user.roomId).emit("new_op", redoneOp);
            }
        } catch (err) { }
    });

    socket.on("cursor_move", (data) => {
        try {
            const user = getCurrentUser(socket.id);
            if (!user) return;
            socket.to(user.roomId).emit("cursor_update", {
                userId: user.id,
                username: user.username,
                color: user.color,
                x: data.x,
                y: data.y
            });
        } catch (err) { }
    });

    socket.on("disconnect", () => {
        try {
            const user = userLeave(socket.id);
            if (user) {
                const remainingUsers = getRoomUsers(user.roomId);
                if (remainingUsers.length === 0) {
                    clearRoom(user.roomId);
                } else {
                    io.to(user.roomId).emit("user_update", remainingUsers);
                }
            }
        } catch (err) { }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
});
