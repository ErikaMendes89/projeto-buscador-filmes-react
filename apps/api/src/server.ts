import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { services } from './container.js';
import { attachConversationRealtime } from './modules/social/conversations.realtime.js';

const server = createServer(app);
attachConversationRealtime(server, services.auth, services.conversations, config.WEB_ORIGIN);
server.listen(config.API_PORT, () => console.log(`MovieMatch API em http://localhost:${config.API_PORT}`));
