// This array will store all the users who are currently connected to my app
const currentUsers = [];

// This function helps a new user join a room
const addUserToRoom = (socketId, userName, roomId) => {
    // Assigning a random color to each user so they look different on the canvas
    const newUser = { id: socketId, username: userName, roomId: roomId, color: generateRandomColor() };
    currentUsers.push(newUser);
    return newUser;
};

// Using this to find a user's details based on their socket ID
const findUserById = (socketId) => {
    return currentUsers.find((user) => user.id === socketId);
};

// When someone leaves, remove them from my list
const removeUserFromList = (socketId) => {
    const userIndex = currentUsers.findIndex((user) => user.id === socketId);
    if (userIndex !== -1) {
        // Using splice to take the user out of the array
        return currentUsers.splice(userIndex, 1)[0];
    }
};

// This gives me a list of all people in a specific room
const getAllUsersInRoom = (roomId) => {
    return currentUsers.filter((user) => user.roomId === roomId);
};

// A simple helper to get random colors for cursors
function generateRandomColor() {
    const hexCodes = '0123456789ABCDEF';
    let colorString = '#';
    for (let i = 0; i < 6; i++) {
        colorString += hexCodes[Math.floor(Math.random() * 16)];
    }
    return colorString;
}

// Exporting these so we can use them in my main server file
module.exports = {
    addUserToRoom,
    findUserById,
    removeUserFromList,
    getAllUsersInRoom
};
