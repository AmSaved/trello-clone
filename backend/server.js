const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Board = require('./models/Board');
const List = require('./models/List');
const Card = require('./models/Card');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('🚀 Trello Clone API Server is Running!');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// Socket.io for real-time updates
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
}).on('connection', (socket) => {
    console.log('🔌 User connected:', socket.userId);

    socket.on('join-board', (boardId) => {
        socket.join(`board-${boardId}`);
    });

    socket.on('leave-board', (boardId) => {
        socket.leave(`board-${boardId}`);
    });

    socket.on('card-moved', (data) => {
        socket.to(`board-${data.boardId}`).emit('card-updated', data);
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected');
    });
});

// ============= AUTH ROUTES =============
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = new User({ name, email, password });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.status(201).json({ token, user: { id: user._id, name, email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.json({ token, user: { id: user._id, name: user.name, email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= BOARD ROUTES =============
app.post('/api/boards', auth, async (req, res) => {
    try {
        const { title, backgroundColor } = req.body;
        const board = new Board({
            title,
            backgroundColor,
            owner: req.userId,
            members: [req.userId]
        });
        await board.save();

        // Add board to user's boards
        await User.findByIdAndUpdate(req.userId, {
            $push: { boards: board._id }
        });

        res.status(201).json(board);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/boards', auth, async (req, res) => {
    try {
        const boards = await Board.find({ members: req.userId })
            .populate('lists');
        res.json(boards);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/boards/:boardId', auth, async (req, res) => {
    try {
        const board = await Board.findById(req.params.boardId)
            .populate({
                path: 'lists',
                populate: {
                    path: 'cards'
                }
            });
        
        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Check if user is member
        if (!board.members.includes(req.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(board);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= LIST ROUTES =============
app.post('/api/boards/:boardId/lists', auth, async (req, res) => {
    try {
        const { title } = req.body;
        const board = await Board.findById(req.params.boardId);

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        const list = new List({
            title,
            board: req.params.boardId,
            position: board.lists.length
        });
        await list.save();

        board.lists.push(list._id);
        await board.save();

        // Emit real-time update
        io.to(`board-${req.params.boardId}`).emit('list-created', list);

        res.status(201).json(list);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= CARD ROUTES =============
app.post('/api/lists/:listId/cards', auth, async (req, res) => {
    try {
        const { title } = req.body;
        const list = await List.findById(req.params.listId);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const card = new Card({
            title,
            list: req.params.listId,
            position: list.cards.length
        });
        await card.save();

        list.cards.push(card._id);
        await list.save();

        // Emit real-time update
        const board = await Board.findOne({ lists: list._id });
        io.to(`board-${board._id}`).emit('card-created', card);

        res.status(201).json(card);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/cards/:cardId/move', auth, async (req, res) => {
    try {
        const { sourceListId, destinationListId, newPosition } = req.body;
        const card = await Card.findById(req.params.cardId);

        // Remove from source list
        await List.findByIdAndUpdate(sourceListId, {
            $pull: { cards: card._id }
        });

        // Add to destination list at position
        await List.findByIdAndUpdate(destinationListId, {
            $push: { cards: { $each: [card._id], $position: newPosition } }
        });

        card.list = destinationListId;
        card.position = newPosition;
        await card.save();

        // Emit real-time update
        const board = await Board.findOne({ lists: destinationListId });
        io.to(`board-${board._id}`).emit('card-moved', card);

        res.json({ message: 'Card moved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});