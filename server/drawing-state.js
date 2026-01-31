const roomHistories = {};
const roomRedoStacks = {};

const getHistory = (roomId) => {
    if (!roomHistories[roomId]) {
        roomHistories[roomId] = [];
    }
    return roomHistories[roomId];
};

const addOperation = (roomId, operation) => {
    if (!roomHistories[roomId]) {
        roomHistories[roomId] = [];
    }
    roomHistories[roomId].push(operation);
    roomRedoStacks[roomId] = [];
    return operation;
};

const undo = (roomId) => {
    const history = getHistory(roomId);
    if (history.length === 0) return null;

    const op = history.pop();

    if (!roomRedoStacks[roomId]) roomRedoStacks[roomId] = [];
    roomRedoStacks[roomId].push(op);

    return op;
};

const redo = (roomId) => {
    if (!roomRedoStacks[roomId] || roomRedoStacks[roomId].length === 0) return null;

    const op = roomRedoStacks[roomId].pop();
    const history = getHistory(roomId);
    history.push(op);

    return op;
};

const clearRoom = (roomId) => {
    delete roomHistories[roomId];
    delete roomRedoStacks[roomId];
};

module.exports = {
    getHistory,
    addOperation,
    undo,
    redo,
    clearRoom
};
