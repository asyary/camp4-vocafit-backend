const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true
        },
		path: '/ws/'
    });

    // Namespaces
    require('../modules/gym_visits/visit.socket')(io);
    require('../modules/gym_visits/crowd.socket')(io);
    require('../modules/notifications/notification.socket')(io);

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIO };