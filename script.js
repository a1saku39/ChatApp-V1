// チャットアプリケーションのメインクラス
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.messages = [];
        this.onlineUsers = new Set();
        this.socket = null;

        // DOM要素の取得
        this.loginModal = document.getElementById('loginModal');
        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.currentUserNameDisplay = document.getElementById('currentUserName');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.fileInput = document.getElementById('fileInput');
        this.onlineUsersContainer = document.getElementById('onlineUsers');
        this.emptyState = document.getElementById('emptyState');
        this.searchInput = document.getElementById('searchInput');

        this.init();
    }

    init() {
        // Socket.ioの初期化
        this.socket = io();

        // イベントリスナーの設定
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e));

        // サイドバー（モバイルメニュー）の制御
        const menuBtn = document.getElementById('menuBtn');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const sidebar = document.getElementById('sidebar');

        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.add('active');
                // 背景クリックで閉じるためのオーバーレイがあればここで表示するなど
            });
        }

        if (closeMenuBtn && sidebar) {
            closeMenuBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        // サイドバー外側クリックで閉じる処理
        document.addEventListener('click', (e) => {
            if (sidebar && sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                !menuBtn.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });

        // Socket.ioイベントの設定
        this.setupSocketEvents();

        // 通知の許可をリクエスト
        if ('Notification' in window) {
            Notification.requestPermission();
        }

        // ユーザーがログイン済みかチェック (セッションストレージを使用)
        const savedUser = sessionStorage.getItem('chatAppUser');
        if (savedUser) {
            this.login(savedUser);
        }
    }

    setupSocketEvents() {
        // 初期メッセージの受信
        this.socket.on('init_messages', (messages) => {
            this.messages = messages;
            this.renderMessages();
        });

        // 新規メッセージの受信
        this.socket.on('receive_message', (message) => {
            this.messages.push(message);
            this.addMessageToDOM(message);

            // 通知を表示 (自分以外のメッセージの場合)
            if (message.author !== this.currentUser) {
                this.showNotification(message);
            }
        });

        // ユーザー参加通知
        this.socket.on('user_joined', (data) => {
            this.updateOnlineUsers(data.onlineUsers);
            this.addSystemMessage(`${data.username}さんが参加しました`);
        });

        // ユーザー退出通知
        this.socket.on('user_left', (data) => {
            this.updateOnlineUsers(data.onlineUsers);
            this.addSystemMessage(`${data.username}さんが退出しました`);
        });
    }

    handleLogin(e) {
        e.preventDefault();
        const username = this.usernameInput.value.trim();

        if (username.length < 2) {
            alert('ユーザー名は2文字以上で入力してください');
            return;
        }

        this.login(username);
    }

    login(username) {
        this.currentUser = username;
        sessionStorage.setItem('chatAppUser', username);

        // サーバーに参加通知
        this.socket.emit('join', username);

        // UI更新
        this.loginModal.classList.add('hidden');
        this.currentUserNameDisplay.textContent = this.currentUser;
        this.messageInput.focus();
    }

    handleSendMessage(e) {
        e.preventDefault();
        const messageText = this.messageInput.value.trim();

        if (!messageText) return;

        const messageData = {
            author: this.currentUser,
            text: messageText,
            type: 'text'
        };

        this.socket.emit('send_message', messageData);
        this.messageInput.value = '';
        this.messageInput.focus();
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // ファイルサイズチェック (5MB制限)
        if (file.size > 5 * 1024 * 1024) {
            alert('ファイルサイズは5MB以下にしてください');
            this.fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();

            const messageData = {
                author: this.currentUser,
                text: `${file.name}を送信しました`,
                type: data.type, // 'image' or 'file'
                fileUrl: data.url,
                fileName: data.filename
            };

            this.socket.emit('send_message', messageData);

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('ファイルのアップロードに失敗しました');
        }

        this.fileInput.value = '';
    }

    handleSearch(e) {
        const query = e.target.value.toLowerCase();
        this.renderMessages(query);
    }

    renderMessages(query = '') {
        this.messagesContainer.innerHTML = '';

        // 空の状態を表示するか判定
        if (this.messages.length === 0) {
            if (this.emptyState) this.emptyState.style.display = 'flex';
            return;
        } else {
            if (this.emptyState) this.emptyState.style.display = 'none';
        }

        const filteredMessages = this.messages.filter(msg =>
            msg.text.toLowerCase().includes(query) ||
            msg.author.toLowerCase().includes(query)
        );

        filteredMessages.forEach(msg => {
            this.addMessageToDOM(msg);
        });

        this.scrollToBottom();
    }

    addMessageToDOM(message) {
        // 検索フィルタ適用中は、フィルタに一致しないメッセージは追加しない
        const query = this.searchInput.value.toLowerCase();
        if (query && !message.text.toLowerCase().includes(query) && !message.author.toLowerCase().includes(query)) {
            return;
        }

        if (this.emptyState) this.emptyState.style.display = 'none';

        const isOwn = message.author === this.currentUser;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = message.author;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = this.formatTime(message.timestamp);

        messageHeader.appendChild(authorSpan);
        messageHeader.appendChild(timeSpan);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        // メッセージタイプに応じた表示
        if (message.type === 'image') {
            const img = document.createElement('img');
            img.src = message.fileUrl;
            img.className = 'message-image';
            img.alt = 'Uploaded image';
            img.onclick = () => window.open(message.fileUrl, '_blank');
            messageContent.appendChild(img);
        } else if (message.type === 'file') {
            const link = document.createElement('a');
            link.href = message.fileUrl;
            link.className = 'message-file';
            link.textContent = `📎 ${message.fileName}`;
            link.target = '_blank';
            messageContent.appendChild(link);
        } else {
            messageContent.textContent = message.text;
        }

        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageContent);

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'system-message';
        systemDiv.textContent = text;
        this.messagesContainer.appendChild(systemDiv);
        this.scrollToBottom();
    }

    updateOnlineUsers(users) {
        this.onlineUsersContainer.innerHTML = '';

        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.textContent = user;
            if (user === this.currentUser) {
                userItem.classList.add('current-user');
                userItem.textContent += ' (あなた)';
            }
            this.onlineUsersContainer.appendChild(userItem);
        });
    }

    showNotification(message) {
        if (document.hidden && Notification.permission === 'granted') {
            new Notification(`新着メッセージ: ${message.author}`, {
                body: message.text,
                icon: '/favicon.ico' // アイコンがあれば設定
            });
        }
    }

    formatTime(date) {
        const now = new Date();
        const messageDate = new Date(date);
        const diffInMinutes = Math.floor((now - messageDate) / 1000 / 60);

        if (diffInMinutes < 1) {
            return 'たった今';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes}分前`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${hours}時間前`;
        } else {
            const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            return messageDate.toLocaleDateString('ja-JP', options);
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
