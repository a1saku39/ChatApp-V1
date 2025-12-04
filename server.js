const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// データ保存用のディレクトリとファイル
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// メッセージデータの読み込み
let messages = [];
if (fs.existsSync(MESSAGES_FILE)) {
    try {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading messages:', e);
    }
}

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // 静的ファイルを提供
app.use('/uploads', express.static(UPLOADS_DIR)); // アップロードファイルを提供

// ファイルアップロード設定 (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// API: ファイルアップロード
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    res.json({
        url: fileUrl,
        filename: req.file.originalname,
        type: fileType,
        size: req.file.size
    });
});

// Socket.io 接続処理
io.on('connection', (socket) => {
    console.log('A user connected');

    // 接続時に既存のメッセージを送信
    socket.emit('init_messages', messages);

    // ユーザー参加通知
    socket.on('join', (username) => {
        socket.username = username;
        io.emit('user_joined', { username, onlineUsers: getOnlineUsers() });
    });

    // メッセージ受信
    socket.on('send_message', (data) => {
        const message = {
            id: Date.now(),
            author: data.author,
            text: data.text,
            type: data.type || 'text', // text, image, file
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
            timestamp: new Date()
        };

        messages.push(message);

        // 最新100件のみ保持
        if (messages.length > 100) {
            messages = messages.slice(-100);
        }

        // ファイルに保存
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

        // 全員に送信
        io.emit('receive_message', message);
    });

    // 切断時
    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('user_left', { username: socket.username, onlineUsers: getOnlineUsers() });
        }
    });
});

function getOnlineUsers() {
    const users = new Set();
    // Socket.io v4 method to get sockets
    const sockets = io.sockets.sockets;
    for (const [id, socket] of sockets) {
        if (socket.username) {
            users.add(socket.username);
        }
    }
    return Array.from(users);
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
