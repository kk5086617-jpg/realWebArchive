import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAuthRouter, hashPassword, verifyPassword } from './auth.js';
import sharp from 'sharp';
import { prepareImage } from './profiles.js';
import { attachChatSocket, chatEvents } from './chatSocket.js';
import { WebSocket } from 'ws';

test('chat broadcasts messages over WebSocket and rejects a foreign origin', async () => {
  const server = express().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const sockets = attachChatSocket(server);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const socket = new WebSocket(origin.replace('http:', 'ws:') + '/ws/chat', { origin });
  try {
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    const received = new Promise(resolve => socket.once('message', data => resolve(JSON.parse(data))));
    chatEvents.emit('message', { id: 77, body: 'live message' });
    assert.deepEqual(await received, { type: 'message', post: { id: 77, body: 'live message' } });
    const foreign = new WebSocket(origin.replace('http:', 'ws:') + '/ws/chat', { origin: 'https://other.example' });
    const rejected = await new Promise(resolve => {
      foreign.once('unexpected-response', (_req, response) => { resolve(response.statusCode); response.resume(); foreign.terminate(); });
      foreign.on('error', () => {});
    });
    assert.equal(rejected, 403);
  } finally {
    socket.terminate();
    for (const client of sockets.clients) client.terminate();
    await new Promise(resolve => server.close(resolve));
  }
});

test('profile images are decoded, resized and reject invalid uploads', async () => {
  const input = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#aaaaaa' } }).png().toBuffer();
  const output = await prepareImage(`data:image/png;base64,${input.toString('base64')}`, true);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 256);
  await assert.rejects(prepareImage('data:image/svg+xml;base64,AAAA'));
  await assert.rejects(prepareImage('data:image/png;base64,AAAA'));
  await assert.rejects(prepareImage('x'.repeat(2800001)));
});

test('GIF attachments preserve frames and timing, while avatars stay static', async () => {
  const pixels = Buffer.alloc(8 * 16 * 3);
  for (let i = 0; i < 8 * 16; i++) pixels[i * 3 + (i < 64 ? 0 : 2)] = 255;
  const gif = await sharp(pixels, { raw: { width: 8, height: 16, channels: 3, pageHeight: 8 } })
    .gif({ delay: [100, 200], loop: 0 }).toBuffer();
  const input = `data:image/gif;base64,${gif.toString('base64')}`;
  const animation = await sharp(await prepareImage(input), { animated: true }).metadata();
  assert.equal(animation.pages, 2);
  assert.deepEqual(animation.delay, [100, 200]);
  const avatar = await sharp(await prepareImage(input, true)).metadata();
  assert.ok(!avatar.pages || avatar.pages === 1);
});

test('password hashing uses random salts and rejects an incorrect password', async () => {
  const first = await hashPassword('a-test-password');
  const second = await hashPassword('a-test-password');
  assert.notEqual(first, second);
  assert.equal(first.includes('a-test-password'), false);
  assert.equal(await verifyPassword('a-test-password', first), true);
  assert.equal(await verifyPassword('another-password', first), false);
  assert.equal(await verifyPassword('a-test-password', 'not-a-hash'), false);
});

test('auth endpoints reject cross-origin writes and invalid registration', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ query: () => { throw Error('Unexpected DB access'); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const guest = await fetch(`${origin}/api/auth/me`);
    assert.deepEqual(await guest.json(), { user: null });
    assert.equal(guest.headers.get('cache-control'), 'no-store');
    const blocked = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: '{}',
    });
    assert.equal(blocked.status, 403);
    const invalid = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username: 'valid-user', password: 'short' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, 'INVALID_PASSWORD');
    for (let i = 0; i < 19; i++) {
      const attempt = await fetch(`${origin}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ username: 'valid-user', password: 'short' }),
      });
      assert.equal(attempt.status, 400);
    }
    const limited = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}',
    });
    assert.equal(limited.status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
