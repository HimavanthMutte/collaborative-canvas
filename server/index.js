const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./rooms");
const { getHistory, addOperation, undo, redo } = require("./drawing-state");

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
        const { username, roomId } = data;
        socket.join(roomId);

        const user = userJoin(socket.id, username, roomId);
        const history = getHistory(roomId);

        socket.emit("init_state", history);
        io.to(roomId).emit("user_update", getRoomUsers(roomId));
    });

    socket.on("draw_op", (data) => {
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
    });

    socket.on("draw_step", (data) => {
        const user = getCurrentUser(socket.id);
        if (!user) return;
        socket.to(user.roomId).emit("draw_step", { ...data, userId: user.id });
    });

    socket.on("undo", () => {
        const user = getCurrentUser(socket.id);
        if (!user) return;

        const undoneOp = undo(user.roomId);
        if (undoneOp) {
            io.to(user.roomId).emit("undo_op", undoneOp.id);
        }
    });

    socket.on("redo", () => {
        const user = getCurrentUser(socket.id);
        if (!user) return;

        const redoneOp = redo(user.roomId);
        if (redoneOp) {
            io.to(user.roomId).emit("new_op", redoneOp);
        }
    });

    socket.on("cursor_move", (data) => {
        const user = getCurrentUser(socket.id);
        if (!user) return;
        socket.to(user.roomId).emit("cursor_update", {
            userId: user.id,
            username: user.username,
            color: user.color,
            x: data.x,
            y: data.y
        });
    });

    socket.on("disconnect", () => {
        const user = userLeave(socket.id);
        if (user) {
            io.to(user.roomId).emit("user_update", getRoomUsers(user.roomId));
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
