import { io } from "socket.io-client";

// I set autoConnect to false so I can manually start the connection when I click 'Join'
export const socket = io("http://localhost:3001", {
    autoConnect: false,
});
