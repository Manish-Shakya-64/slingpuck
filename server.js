const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {}; // roomCode: { players: { socketId: { name, side } } }

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', (data) => {
        const { username } = data;
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();

        rooms[roomCode] = {
            players: {
                [socket.id]: { name: username, side: 'bottom' }
            }
        };

        socket.join(roomCode);
        socket.emit('room_joined', { roomCode, side: 'bottom', players: rooms[roomCode].players });
        console.log(`Room ${roomCode} created by ${username}`);
    });

    socket.on('join_room', (data) => {
        const { username, roomCode } = data;
        const code = roomCode.toUpperCase();

        if (rooms[code]) {
            const playerCount = Object.keys(rooms[code].players).length;
            if (playerCount < 2) {
                const side = Object.values(rooms[code].players).find(p => p.side === 'bottom') ? 'top' : 'bottom';
                rooms[code].players[socket.id] = { name: username, side };
                socket.join(code);
                socket.emit('room_joined', { roomCode: code, side, players: rooms[code].players });
                io.to(code).emit('player_joined', rooms[code].players);
                console.log(`${username} joined room ${code}`);
            } else {
                socket.emit('error', 'Room is full.');
            }
        } else {
            socket.emit('error', 'Room not found.');
        }
    });

    socket.on('update_pucks', (data) => {
        const { roomCode, pucks } = data;
        socket.to(roomCode).emit('opponent_update', { pucks });
    });

    socket.on('win', (data) => {
        const { roomCode, side } = data;
        io.to(roomCode).emit('game_over', side);
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            if (rooms[code].players[socket.id]) {
                delete rooms[code].players[socket.id];
                if (Object.keys(rooms[code].players).length === 0) {
                    delete rooms[code];
                } else {
                    io.to(code).emit('player_left', rooms[code].players);
                }
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
