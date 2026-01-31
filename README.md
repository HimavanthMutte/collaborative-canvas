# Real-Time Collaborative Canvas

A multi-user drawing application where users can draw on a shared canvas in real-time.

## Features
- **Real-time Synchronization**: Drawings appear instantly as they are being drawn.
- **Global Undo/Redo**: Shared history stack allows undoing the last global action.
- **User Presence**: See who is online and where their cursors are.
- **Tools**: Pen, Eraser, Rectangle, Circle.

## Tech Stack
- **Frontend**: React, Raw HTML Canvas API.
- **Backend**: Node.js, Express, Socket.io.

## Installation & Running

### 1. Start the Server
```bash
cd server
npm install
node server.js
```
Server runs on http://localhost:3001.

### 2. Start the Client
```bash
cd client
npm install
npm start
```
Client runs on http://localhost:3000.
