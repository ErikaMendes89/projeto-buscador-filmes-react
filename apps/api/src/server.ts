import { app } from './app.js';
import { config } from './config.js';

app.listen(config.API_PORT, () => console.log(`MovieMatch API em http://localhost:${config.API_PORT}`));
