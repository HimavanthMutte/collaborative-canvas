# My Real-Time Collaborative Canvas

I created this multi-user drawing application so friends can draw together on a shared canvas in real-time. It was a fun challenge to learn how WebSockets and Canvas work together!

## Features I implemented
- **Real-time Sync**: Drawing updates instantly for everyone in the room.
- **Global Undo/Redo**: I built a shared history stack on the server so anyone can undo the last action made in the room.
- **Live Cursors**: I can see where other people are pointing their mouse.
- **Drawing Tools**: I added a Pen, Eraser, Rectangle, and Circle tool.

## Tech Stack I used
- **Frontend**: React and the basic HTML Canvas API.
- **Backend**: Node.js with Express and Socket.io for the real-time stuff.

## How to Install & Run my project

1. **Install everything**:
   ```bash
   npm install
   ```
   I set this up so it automatically installs dependencies for both the client and the server folders.

2. **Configure environment variables**:
   Create a `.env` file in the `client` folder based on `.env.example`:
   ```bash
   cp client/.env.example client/.env
   ```
   Make sure `VITE_BACKEND_URL` is set to your server's address (default is `http://localhost:3001`).

3. **Start the app**:
   ```bash
   npm start
   ```
   This command starts my backend server (on port 3001) and my React frontend (on port 3000) at the same time.

## How I test this with multiple people

1. I open http://localhost:3000 in my main browser.
2. I type my name and a Room ID (like "MyRoom").
3. I open a **New Incognito Window** (or use another browser like Edge).
4. I go to http://localhost:3000 again and type a *different* name but the **exact same Room ID**.
5. When I draw in one window, I can see it appearing in the other one instantly!

## Things I might improve later (Known Issues)

- **Memory**: Right now, I store all drawing data in the server's RAM. If I restart the server, everything is gone. I'd like to add a database later.
- **Security**: There are no passwords for rooms yet; anyone with the ID can join.
- **Performance**: If I draw thousands of shapes, the canvas might slow down because I redraw the whole history on some events.
- **Layers**: I don't have layer support yet; everything is drawn in the order it was created.

## Total Time I Spent
I spent about **12 hours** working on this project (including learning React Hooks, Socket.io, and debugging the canvas rendering).
