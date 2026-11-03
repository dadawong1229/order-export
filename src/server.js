import { createServer } from 'node:http';
import { createRequestHandler } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const server = createServer(createRequestHandler());

server.listen(port, () => {
  console.log(`order-export listening on http://localhost:${port}`);
});
