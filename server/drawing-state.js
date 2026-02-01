// Store the drawing history and redo stacks for each room in these objects
const drawingHistories = {};
const redoHistoryStacks = {};

// This function gets the drawing history for a specific room
const getRoomHistory = (roomId) => {
    // If the room doesn't exist yet, I create an empty array for it
    if (!drawingHistories[roomId]) {
        drawingHistories[roomId] = [];
    }
    return drawingHistories[roomId];
};

// I use this when a user finishes a drawing action
const saveNewOperation = (roomId, drawingData) => {
    if (!drawingHistories[roomId]) {
        drawingHistories[roomId] = [];
    }
    // Add the new shape to the room's history
    drawingHistories[roomId].push(drawingData);

    // When a new thing is drawn, I clear the redo stack because the history changed
    redoHistoryStacks[roomId] = [];
    return drawingData;
};

// This handles the "Undo" request
const undoLastAction = (roomId) => {
    const history = getRoomHistory(roomId);
    if (history.length === 0) return null;

    // Remove the last action from history
    const lastAction = history.pop();

    // Put it into the redo stack so I can bring it back if needed
    if (!redoHistoryStacks[roomId]) redoHistoryStacks[roomId] = [];
    redoHistoryStacks[roomId].push(lastAction);

    return lastAction;
};

// This handles the "Redo" request
const redoLastAction = (roomId) => {
    // If there's nothing to redo, I just return null
    if (!redoHistoryStacks[roomId] || redoHistoryStacks[roomId].length === 0) return null;

    // Take the last undone action from the redo stack
    const actionToRestore = redoHistoryStacks[roomId].pop();
    const history = getRoomHistory(roomId);

    // Put it back into the main history
    history.push(actionToRestore);

    return actionToRestore;
};

// When everyone leaves, I clean up the room data to save memory
const removeRoomData = (roomId) => {
    delete drawingHistories[roomId];
    delete redoHistoryStacks[roomId];
};

module.exports = {
    getRoomHistory,
    saveNewOperation,
    undoLastAction,
    redoLastAction,
    removeRoomData
};
