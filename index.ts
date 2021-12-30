const express = require('express');
const axios = require('axios').default;
const { createServer } = require('http');
const { Server: IOServer } = require('socket.io');

const app = express();
const server = createServer(app);

const io = new IOServer(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true  
    }
});

interface UserInterface {
    username: string;
    avatar: string;
    system: boolean;
};

interface MessageInterface {
    content: string | null;
};

class Message {
    content: string;
    author: {
        username: string;
        avatar: string;
        system: boolean;
    };
    
    constructor(author: UserInterface, message: MessageInterface) {
        this.content = (message.content && message.content.trim()) ? message.content.trim() : 'Sin contenido.';
        
        this.author = {
            username: author.username || 'Desconocido',
            avatar: author.avatar || 'https://cdn.chatglobal.ml/assets/error.png',
            system: author.system || false
        };
    }
}

class SystemMessage extends Message {
    constructor(content: string) {
        super(
            { 
                username: 'System',
                avatar: 'https://cdn.chatglobal.ml/assets/logo.png',
                system: true
            },
            { 
                content: content
            }
        );
    }
}

app.get('/', (req: any, res: any): void => {  
    res.json({ uri: "wss://gateway.chatglobal.ml" });
});

io.use(async (socket: any, next: any): Promise<void> => {
    if (socket.handshake.auth && socket.handshake.auth.token) {

        const token = socket.handshake.auth.token;
        
        if (!token.includes('.')) {
            return next(new Error('Malformed Token'));
        }

        if (token.split('.').length !== 3) {
            return next(new Error('Malformed Token'));
        }

        const user = token.split('.')[0];
        
        if (!user) {
            return next(new Error('Malformed Token'));
        }

        const userData = await axios({
            method: 'post',
            url: `https://accounts.chatglobal.ml/authorize/user/${user}`,
            headers: {
                authorization: token
            }
        }).catch(() => false);

        if (!userData) {
            return next(new Error('Authentication error'));
        }

        return next();
    
    } else {
        return next(new Error('Authentication error'));
    }
}).on('connection', (socket: any): void => {
    socket.emit('MESSAGE_CREATE', new SystemMessage('Conectado al interchat, Papu.'));
    socket.broadcast.emit('MESSAGE_CREATE', new SystemMessage('Papu se conecto al interchat.'));
    
    socket.on('disconnect', (): void => {
        socket.broadcast.emit('MESSAGE_CREATE', new SystemMessage('Papu se desconecto del interchat.'));
    });
    
    socket.on('MESSAGE_CREATE', (msg: MessageInterface): void => {
        io.emit('MESSAGE_CREATE', new Message(            { 
                username: 'Hamilla',
                avatar: 'https://media.discordapp.net/attachments/923615661031317554/925392312190775377/IMG_20211228_151641.jpg',
                system: false
            }, msg));
    });
});

server.listen(3000, (): void => {
    console.log('listening on *:3000');
});