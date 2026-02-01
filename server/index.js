const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// I imported my own helper functions from other files
const { addUserToRoom, findUserById, removeUserFromList, getAllUsersInRoom } = require("./rooms");
const { getRoomHistory, saveNewOperation, undoLastAction, redoLastAction, removeRoomData } = require("./drawing-state");

const app = express();
app.use(cors()); // Used CORS so my React app can talk to this server
require("dotenv").config();
// Created the HTTP server and then connected Socket.io to it
const server = http.createServer(app);

app.get("/health", (req, res) => {
    res.send("OK");
});


const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// This is where the magic happens when a user connects
io.on("connection", (socket) => {

    // A simple ping to verify connectivity
    socket.on("ping", () => {
        socket.emit("pong");
    });

    // When a user hits the 'Join' button in my React app
    socket.on("join_room", (userData) => {
        try {
            const { username, roomId } = userData;
            if (!username || !roomId) return;

            console.log(`User ${username} wants to join room: ${roomId}`);

            // Make the socket join the specific room
            socket.join(roomId);

            // Save the user to my list and give them a random color
            const connectedUser = addUserToRoom(socket.id, username, roomId);

            // Send the existing drawing history to the new person so their canvas isn't blank
            const existingHistory = getRoomHistory(roomId);
            socket.emit("init_state", existingHistory);

            // Tell everyone in the room that a new person joined so they can update their user list
            io.to(roomId).emit("user_update", getAllUsersInRoom(roomId));

            console.log(`User ${username} joined successfully`);
        } catch (error) {
            console.error("Oops, error during join:", error);
        }
    });

    socket.on("draw_op", (drawingValue) => {
        try {
            const activeUser = findUserById(socket.id);
            if (!activeUser) {
                console.log(`Could not find user for draw_op: ${socket.id}`);
                return;
            }
            console.log(`Received draw_op from ${activeUser.username}`);

            // Creating a final object for the drawing with a unique ID and user info
            const finalizedDrawing = {
                ...drawingValue,
                id: "draw_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                userId: activeUser.id,
                username: activeUser.username
            };

            // Save it to history and broadcast it to everyone in the room
            saveNewOperation(activeUser.roomId, finalizedDrawing);
            io.to(activeUser.roomId).emit("new_op", finalizedDrawing);
        } catch (error) {
            console.error("Error in draw_op:", error);
        }
    });

    // This handles the "live" drawing updates so others can see things while they are being drawn
    socket.on("draw_step", (intermediateStep) => {
        try {
            const activeUser = findUserById(socket.id);
            if (!activeUser) return;

            // Sending this to everyone EXCEPT the person who is currently drawing
            socket.to(activeUser.roomId).emit("draw_step", { ...intermediateStep, userId: activeUser.id });
        } catch (error) { }
    });

    // If anyone clicks 'Undo'
    socket.on("undo", () => {
        try {
            const activeUser = findUserById(socket.id);
            if (!activeUser) return;

            const undoneShape = undoLastAction(activeUser.roomId);
            if (undoneShape) {
                // Tell everyone to remove this specific shape ID from their canvas
                io.to(activeUser.roomId).emit("undo_op", undoneShape.id);
            }
        } catch (error) { }
    });

    // If anyone clicks 'Redo'
    socket.on("redo", () => {
        try {
            const activeUser = findUserById(socket.id);
            if (!activeUser) return;

            const redoneShape = redoLastAction(activeUser.roomId);
            if (redoneShape) {
                // Broadcast it like a new drawing operation
                io.to(activeUser.roomId).emit("new_op", redoneShape);
            }
        } catch (error) { }
    });

    // Share cursor movements in real-time
    socket.on("cursor_move", (coordinates) => {
        try {
            const activeUser = findUserById(socket.id);
            if (!activeUser) return;

            socket.to(activeUser.roomId).emit("cursor_update", {
                userId: activeUser.id,
                username: activeUser.username,
                color: activeUser.color,
                x: coordinates.x,
                y: coordinates.y
            });
        } catch (error) { }
    });

    // When a user closes the tab or disconnects
    socket.on("disconnect", () => {
        try {
            const leavingUser = removeUserFromList(socket.id);
            if (leavingUser) {
                console.log(`User ${leavingUser.username} disconnected from ${leavingUser.roomId}`);

                const peopleStillInRoom = getAllUsersInRoom(leavingUser.roomId);

                // If nobody is left, I clear the room history to keep my server fast
                if (peopleStillInRoom.length === 0) {
                    console.log(`Room ${leavingUser.roomId} is empty. Clearing history.`);
                    removeRoomData(leavingUser.roomId);
                } else {
                    // Otherwise, tell others that someone left
                    io.to(leavingUser.roomId).emit("user_update", peopleStillInRoom);
                }
            }
        } catch (error) { }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
