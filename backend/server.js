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

// ============= MIDDLEWARE =============
app.use(cors());
app.use(express.json());

// ============= TEST ROUTE =============
app.get('/', (req, res) => {
    res.send('🚀 Trello Clone API Server is Running!');
});

// ============= MONGODB CONNECTION =============
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.log('❌ MongoDB Error:', err);
        process.exit(1);
    });

// ============= SOCKET.IO =============
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
        console.log(`👤 User ${socket.userId} joined board ${boardId}`);
    });

    socket.on('leave-board', (boardId) => {
        socket.leave(`board-${boardId}`);
    });

    socket.on('card-moved', (data) => {
        socket.to(`board-${data.boardId}`).emit('card-updated', data);
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.userId);
    });
});

// ============= AUTH ROUTES =============
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        console.log('📝 Registration attempt:', { name, email });

        // Validate input
        if (!name || !email || !password) {
            console.log('❌ Missing fields');
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        console.log('📝 Creating new user...');
        const user = new User({ 
            name, 
            email, 
            password
        });
        
        await user.save();
        console.log('✅ User saved to database:', user._id);

        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log('✅ Registration successful for:', email);
        
        res.status(201).json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('❌ Registration error details:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('📝 Login attempt:', { email });

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ Login successful for:', email);
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json({ user });
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= BOARD ROUTES =============
app.post('/api/boards', auth, async (req, res) => {
    try {
        const { title, backgroundColor } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: 'Board title is required' });
        }

        const board = new Board({
            title,
            backgroundColor: backgroundColor || '#0079bf',
            owner: req.userId,
            members: [req.userId]
        });
        
        await board.save();

        // Add board to user's boards
        await User.findByIdAndUpdate(req.userId, {
            $push: { boards: board._id }
        });

        console.log('✅ Board created:', board.title, 'by user:', req.userId);
        res.status(201).json(board);
    } catch (error) {
        console.error('❌ Create board error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/boards', auth, async (req, res) => {
    try {
        const boards = await Board.find({ members: req.userId })
            .populate('lists');
        res.json(boards);
    } catch (error) {
        console.error('❌ Get boards error:', error);
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
        console.error('❌ Get board error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= LIST ROUTES =============
app.post('/api/boards/:boardId/lists', auth, async (req, res) => {
    try {
        const { title } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: 'List title is required' });
        }

        const board = await Board.findById(req.params.boardId);

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Check if user is member
        if (!board.members.includes(req.userId)) {
            return res.status(403).json({ message: 'Access denied' });
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

        console.log('✅ List created:', list.title, 'in board:', board.title);
        res.status(201).json(list);
    } catch (error) {
        console.error('❌ Create list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/lists/:listId', auth, async (req, res) => {
    try {
        const { title } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: 'List title is required' });
        }

        const list = await List.findByIdAndUpdate(
            req.params.listId,
            { title },
            { new: true }
        );
        
        res.json(list);
    } catch (error) {
        console.error('❌ Update list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/lists/:listId', auth, async (req, res) => {
    try {
        const list = await List.findById(req.params.listId);
        
        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Delete all cards in this list
        await Card.deleteMany({ list: list._id });
        
        // Remove list from board
        await Board.findByIdAndUpdate(list.board, {
            $pull: { lists: list._id }
        });
        
        // Delete the list
        await List.findByIdAndDelete(req.params.listId);
        
        console.log('✅ List deleted:', list._id);
        res.json({ message: 'List deleted successfully' });
    } catch (error) {
        console.error('❌ Delete list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= CARD ROUTES =============
app.post('/api/lists/:listId/cards', auth, async (req, res) => {
    try {
        const { title } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: 'Card title is required' });
        }

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

        console.log('✅ Card created:', card.title);
        res.status(201).json(card);
    } catch (error) {
        console.error('❌ Create card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/cards/:cardId', auth, async (req, res) => {
    try {
        const { title, description } = req.body;
        const card = await Card.findByIdAndUpdate(
            req.params.cardId,
            { title, description },
            { new: true }
        ).populate('comments.user', 'name');
        
        res.json(card);
    } catch (error) {
        console.error('❌ Update card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/cards/:cardId', auth, async (req, res) => {
    try {
        const card = await Card.findById(req.params.cardId);
        
        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Remove card from list
        await List.findByIdAndUpdate(card.list, {
            $pull: { cards: card._id }
        });
        
        // Delete the card
        await Card.findByIdAndDelete(req.params.cardId);
        
        console.log('✅ Card deleted:', card._id);
        res.json({ message: 'Card deleted successfully' });
    } catch (error) {
        console.error('❌ Delete card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/cards/:cardId/move', auth, async (req, res) => {
    try {
        const { sourceListId, destinationListId, newPosition } = req.body;
        const card = await Card.findById(req.params.cardId);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Remove from source list
        await List.findByIdAndUpdate(sourceListId, {
            $pull: { cards: card._id }
        });

        // Add to destination list at position
        await List.findByIdAndUpdate(destinationListId, {
            $push: { cards: { $each: [card._id], $position: newPosition } }
        });

        card.list = destinationListId;
        await card.save();

        // Emit real-time update
        const board = await Board.findOne({ lists: destinationListId });
        io.to(`board-${board._id}`).emit('card-moved', card);

        res.json({ message: 'Card moved successfully' });
    } catch (error) {
        console.error('❌ Move card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/cards/:cardId/comments', auth, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ message: 'Comment text is required' });
        }

        const card = await Card.findById(req.params.cardId);
        
        const comment = {
            user: req.userId,
            text,
            createdAt: new Date()
        };
        
        card.comments.push(comment);
        await card.save();
        
        // Populate user info
        await card.populate('comments.user', 'name');
        
        console.log('✅ Comment added to card:', card._id);
        res.status(201).json(card.comments[card.comments.length - 1]);
    } catch (error) {
        console.error('❌ Add comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});