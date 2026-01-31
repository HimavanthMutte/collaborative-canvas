const users = [];

const userJoin = (id, username, roomId) => {
    const user = { id, username, roomId, color: getRandomColor() };
    users.push(user);
    return user;
};

const getCurrentUser = (id) => {
    return users.find((user) => user.id === id);
};

const userLeave = (id) => {
    const index = users.findIndex((user) => user.id === id);
    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
};

const getRoomUsers = (roomId) => {
    return users.filter((user) => user.roomId === roomId);
};

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

module.exports = {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers
};
