import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startProxy } from './acp-proxy.mjs';

const file = fileURLToPath(import.meta.url);
if (process.env.ACP_PROXY_TEST_ADAPTER === 'yes') {
  const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  let promptId;
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', line => {
    const request = JSON.parse(line);
    if (request.id === 'permission') return send({ method: 'test/permission_ack', params: request.result });
    const update = text => send({ method: 'session/update', params: {
      sessionId: 'test-session', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
    } });
    const user = text => send({ method: 'session/update', params: { sessionId: 'test-session', update: {
      sessionUpdate: 'user_message_chunk', content: { type: 'text', text },
    } } });
    if (request.method === 'session/new') {
      send({ id: request.id, result: { sessionId: 'test-session' } });
      send({ id: 'permission', method: 'session/request_permission', params: { sessionId: 'test-session' } });
    } else if (request.method === 'session/prompt') {
      promptId = request.id;
      user(request.params.prompt[0].text);
      update('before');
    } else if (request.method === '_session/steering') {
      assert.equal(request.params._meta.steering.idleBehavior, 'promptRequired');
      const text = request.params.prompt[0].text;
      if (text === 'idle-race') return send({ id: request.id, result: { outcome: 'promptRequired' } });
      if (text !== 'v1 injected') { update(' before-landing'); user(text); }
      update(text === 'v1 injected' ? ' v1 after' : ' after');
      send({ id: request.id, result: { outcome: 'injected' } });
    } else if (request.method === 'test/complete') {
      send({ id: promptId, result: { stopReason: 'end_turn' } });
      send({ id: request.id, result: {} });
    } else if (request.method === 'test/large') {
      update('大'.repeat(100000));
      send({ id: request.id, result: {} });
    } else send({ id: request.id, error: { code: -32601, message: 'original error' } });
  });
} else if (process.argv[2] === 'proxy') {
  process.env.ACP_PROXY_TEST_ADAPTER = 'yes';
  await startProxy({ adapterPath: file, codexPath: process.execPath, bridgeTokenFile: file });
} else {
  const child = spawn(process.execPath, [file, 'proxy'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const messages = [], waiting = [];
  const output = readline.createInterface({ input: child.stdout });
  output.on('line', line => {
    messages.push(JSON.parse(line));
    for (const check of [...waiting]) check();
  });
  const send = message => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
  function waitFor(predicate) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for relay output.')), 5000);
      const check = () => {
        const found = messages.find(predicate);
        if (!found) return;
        clearTimeout(timer);
        waiting.splice(waiting.indexOf(check), 1);
        resolve(found);
      };
      waiting.push(check);
      check();
    });
  }
  const pipe = '\\\\.\\pipe\\webcodex-codex-bridge-' + child.pid;
  function rpc(method, params = {}, auth = fs.readFileSync(file, 'utf8').trim()) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(pipe);
      let buffer = Buffer.alloc(0);
      socket.on('error', reject);
      socket.on('connect', () => {
        const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { token: auth, ...params } }));
        const header = Buffer.alloc(4); header.writeUInt32LE(payload.length);
        socket.write(Buffer.concat([header, payload]));
      });
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 4 || buffer.length < 4 + buffer.readUInt32LE(0)) return;
        socket.destroy();
        resolve(JSON.parse(buffer.subarray(4, 4 + buffer.readUInt32LE(0)).toString()));
      });
    });
  }
  try {
    send({ id: 2, method: 'session/new', params: { cwd: process.cwd() } });
    await waitFor(m => m.id === 2);
    await waitFor(m => m.id === 'permission');
    send({ id: 'permission', result: { approved: false } });
    assert.deepEqual((await waitFor(m => m.method === 'test/permission_ack')).params, { approved: false });
    assert.equal((await rpc('list_sessions')).result.sessions[0].sessionId, 'test-session');
    assert.equal((await rpc('list_sessions', {}, 'wrong')).error.code, -32001);
    assert.deepEqual((await rpc('send_message', { sessionId: 'test-session', prompt: 'idle' })).result,
      { delivered: false, outcome: 'idle' });
    send({ id: 3, method: 'session/prompt', params: { sessionId: 'test-session', prompt: [{ type: 'text', text: 'original' }] } });
    await waitFor(m => m.params?.update?.content?.text === 'before');
    assert.deepEqual((await rpc('send_message', { sessionId: 'test-session', prompt: 'injected' })).result,
      { delivered: true, outcome: 'injected' });
    const history = (await rpc('read_session', { sessionId: 'test-session' })).result.history;
    assert.deepEqual(history, [
      { role: 'user', text: 'original' },
      { role: 'assistant', text: 'before before-landing' },
      { role: 'user', text: 'injected' },
      { role: 'assistant', text: ' after' },
    ]);
    assert.deepEqual((await rpc('send_message', { sessionId: 'test-session', prompt: 'v1 injected' })).result,
      { delivered: true, outcome: 'injected' });
    const v1History = (await rpc('read_session', { sessionId: 'test-session' })).result.history;
    assert.deepEqual(v1History, [...history,
      { role: 'user', text: 'v1 injected' }, { role: 'assistant', text: ' v1 after' },
    ]);
    assert.deepEqual((await rpc('send_message', { sessionId: 'test-session', prompt: 'idle-race' })).result,
      { delivered: false, outcome: 'promptRequired' });
    assert.deepEqual((await rpc('read_session', { sessionId: 'test-session' })).result.history, v1History);
    assert.equal((await rpc('send_message', { sessionId: 'test-session', prompt: 'x'.repeat(65537) })).error.code, -32602);
    assert(!messages.some(m => typeof m.id === 'string' && m.id.startsWith('webcodex-bridge-')));
    send({ id: 4, method: 'test/complete', params: {} }); await waitFor(m => m.id === 4);
    assert.equal((await rpc('send_message', { sessionId: 'test-session', prompt: 'idle again' })).result.delivered, false);
    send({ id: 5, method: 'original/unknown' });
    assert.equal((await waitFor(m => m.id === 5)).error.message, 'original error');
    send({ id: 6, method: 'test/large' }); await waitFor(m => m.id === 6);
    const large = (await rpc('read_session', { sessionId: 'test-session' })).result;
    assert(large.truncated);
    assert(large.history.reduce((sum, entry) => sum + Buffer.byteLength(entry.text), 0) <= 256 * 1024);
    assert(large.history.length <= 100);
    child.stdin.end();
    const code = await new Promise(resolve => child.once('close', resolve));
    assert.equal(code, 0);
    console.log('ACP proxy checks passed: relay, permissions/errors, auth, idle/race refusal, injection demux, v1/v2 transcript order, prompt/history bounds, EOF cleanup.');
  } finally { child.kill(); }
}
