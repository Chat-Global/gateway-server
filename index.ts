const express = require('express');
const axios = require('axios').default;
const { createServer } = require('http');
const { simpleflake } = require('simpleflakes');
const { Server: IOServer } = require('socket.io');

const app = express();
const server = createServer(app);

const snowflake = () => simpleflake(Date.now(), null, 1581983347347).toString();

const io = new IOServer(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true  
    }
});

interface UserInterface {
    id: string;
    username?: string;
    avatar?: string | null;
    system: boolean;
    token?: string | null;
};

class User {
    id: string;
    username: string;
    avatar: string;
    system: boolean;

    constructor(user: UserInterface) {
        this.id = user.id,
        this.username = user.username || 'Desconocido',
        this.avatar = user.avatar || 'https://cdn.chatglobal.ml/assets/error.png',
        this.system = user.system || false
    }
}

interface MessageInterface {
    content: string | null;
};

class Message {
    id: string;
    content: string;
    author: {
        id: string;
        username: string;
        avatar: string;
        system: boolean;
    };
    timestamp: number;
    
    constructor(author: UserInterface, message: MessageInterface) {
        this.id = snowflake();
        
        this.content = (message.content && message.content.trim()) ? message.content.trim() : 'Sin contenido.';
        
        this.author = new User(author);

        this.timestamp = new Date().getTime();
    }
}

class SystemMessage extends Message {
    constructor(content: string) {
        super(
            { 
                id: '000000',
                username: 'Chat Global',
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
    res.json({ uri: 'wss://gateway.chatglobal.ml' });
});

io.use(async (socket: any, next: any): Promise<void> => {
    if (socket.handshake.auth && socket.handshake.auth.token && socket.handshake.auth.interchat) {

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

        const userData = await axios(
            {
                method: 'post',
                url: `https://accounts.chatglobal.ml/authorize/user/${user}`,
                headers: {
                    authorization: token
                }
            }
        ).catch((): boolean => false);

        if (!userData) {
            return next(new Error('Authentication error'));
        }

        const interchats = [
    		{
    			id: 'es',
    			avatar: 'https://cdn.chatglobal.ml/assets/logo.png',
    			name: 'Interchat español',
    			description: 'Interchat español de Chat Global Oficial.',
    			banner: 'https://cdn.chatglobal.ml/assets/thumbnail.png'
    		},
    		{
    			id: 'en',
    			avatar: 'https://cdn.discordapp.com/attachments/923615661031317554/924342056405585970/1200px-SAS_Group_logo.png',
    			name: 'English Interchat',
    			description: 'amongus',
    			banner: 'https://cdn.discordapp.com/attachments/923615661031317554/924342056405585970/1200px-SAS_Group_logo.png'
    		},
    		{
    			id: 'amogus',
    			avatar: 'https://logos-marcas.com/wp-content/uploads/2021/08/Among-Us-Logo.png',
    			name: 'amogus',
    			description: 'amongus',
    			banner: 'https://logos-marcas.com/wp-content/uploads/2021/08/Among-Us-Logo.png'
    		}
    	];

        const interchat = interchats.find(interchat => interchat.id === socket.handshake.auth.interchat)

        if (!interchat) return next(new Error('Invalid interchat provided'));

        socket.user = userData.data;

        socket.interchat = interchat; 

        return next();
    
    } else {
        return next(new Error('Authentication error'));
    }
}).on('connection', (socket: any): void => {

    socket.join(socket.interchat.id);

    const interchatRoom = io.sockets.adapter.rooms.get(socket.interchat.id)

    const usersInstances: User[] = interchatRoom ? Array.from(interchatRoom.keys()).map(socketID => new User(io.sockets.sockets.get(socketID).user)) : [];

    const ids = usersInstances.map(userInstance => userInstance.id);
    
    const users = usersInstances.filter(({ id }, index) => !ids.includes(id, index + 1));
    
    const isUniqueConnection = usersInstances.filter(({ id }) => id === socket.user.id).length === 1;
    
    socket.emit('MESSAGES_LIST', []);

    socket.emit('MEMBERS_LIST', users);
    
    if (isUniqueConnection) socket.broadcast.to(socket.interchat.id).emit('MEMBER_UPDATE', 'connect', new User(socket.user));

    socket.emit('MESSAGE_CREATE', new SystemMessage('Te has conectado al interchat.'));
    
    if (isUniqueConnection) socket.broadcast.to(socket.interchat.id).emit('MESSAGE_CREATE', new SystemMessage(`${socket.user.username} se conecto al interchat.`));
    
    socket.on('disconnect', (): void => {
        const room = io.sockets.adapter.rooms.get(socket.interchat.id);
        if (room && !(Array.from(room.keys()).find(socketID => new User(io.sockets.sockets.get(socketID).user).id === socket.user.id))) {
            socket.broadcast.to(socket.interchat.id).emit('MEMBER_UPDATE', 'disconnect', new User(socket.user));
            socket.broadcast.to(socket.interchat.id).emit('MESSAGE_CREATE', new SystemMessage(`${socket.user.username} se desconecto del interchat.`));
        }
    });
    
    socket.on('MESSAGE_CREATE', (msg: MessageInterface): void => {
        io.to(socket.interchat.id).emit('MESSAGE_CREATE', new Message(socket.user, msg));
    });
});

server.listen(3000, (): void => {
    console.log('Listening on *:3000');
});