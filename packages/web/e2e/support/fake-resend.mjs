// Stand-in for the Resend HTTP API in the e2e stack (CLN-017).
//
// The backend sends email with the official `resend` SDK, which honours
// RESEND_BASE_URL. Pointing it here keeps the real outbox -> BullMQ -> dispatch
// -> Resend path under test while the tests read the delivered mail back:
//
//   POST /emails             what the SDK calls; stores the message
//   GET  /__e2e/emails?to=x  the messages sent to x, oldest first
//   GET  /health             readiness probe for Playwright's webServer
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env['FAKE_RESEND_PORT'] ?? 3901);
const sent = [];

function reply(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function recipients(to) {
  return (Array.isArray(to) ? to : [to]).map((address) => String(address).toLowerCase());
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    reply(res, 200, { ok: true });

    return;
  }

  if (req.method === 'POST' && url.pathname === '/emails') {
    if (!(req.headers['authorization'] ?? '').startsWith('Bearer ')) {
      reply(res, 401, { name: 'missing_api_key', message: 'Missing API key' });

      return;
    }
    const message = JSON.parse(await readBody(req));
    const id = randomUUID();
    sent.push({ id, to: recipients(message.to), subject: message.subject, html: message.html });
    reply(res, 200, { id });

    return;
  }

  if (req.method === 'GET' && url.pathname === '/__e2e/emails') {
    const to = (url.searchParams.get('to') ?? '').toLowerCase();
    reply(
      res,
      200,
      sent.filter((message) => message.to.includes(to)),
    );

    return;
  }

  reply(res, 404, { name: 'not_found', message: `${req.method} ${url.pathname}` });
}

createServer((req, res) => {
  handle(req, res).catch((error) =>
    reply(res, 500, { name: 'fake_error', message: String(error) }),
  );
}).listen(port, '127.0.0.1', () => {
  console.log(`fake Resend listening on ${port}`);
});
