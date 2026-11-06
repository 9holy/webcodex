// Optional Windows-only live preview/steering; closed runs are never resumed here.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';

const MAX_FRAME = 8 * 1024 * 1024;
const MAX_HISTORY = 256 * 1024;

export async function startProxy(config) {
  for (const key of ['adapterPath', 'codexPath', 'bridgeTokenFile']) {
    if (typeof config[key] !== 'string' || !path.isAbsolute(config[key]) || !fs.statSync(config[key]).isFile()) {
      throw new Error(`${key} must name an existing absolute file.`);
    }
  }
  const token = Buffer.from(fs.readFileSync(config.bridgeTokenFile, 'utf8').trim());
  if (!token.length) throw new Error('The bridge token file is empty.');
  const pipe = '\\\\.\\pipe\\webcodex-codex-bridge-' + process.pid;
  const sessions = new Map(), original = new Map(), owned = new Map(), sockets = new Set();
  let child, stopping = false;

  function session(id, cwd) {
    let value = sessions.get(id);
    if (!value) {
      value = { sessionId: id, cwd: cwd ?? null, active: 0, history: [], bytes: 0, truncated: false, assistant: null };
      sessions.set(id, value);
    }
    if (cwd !== undefined) value.cwd = cwd;
    return value;
  }
  const summary = value => ({ sessionId: value.sessionId, cwd: value.cwd, status: value.active ? 'running' : 'idle' });

  function trimHistory(value) {
    while (value.history.length > 100 || (value.bytes > MAX_HISTORY && value.history.length > 1)) {
      value.bytes -= Buffer.byteLength(value.history.shift().text);
      value.truncated = true;
    }
    if (value.bytes > MAX_HISTORY) {
      const entry = value.history[0];
      const bytes = Buffer.from(entry.text);
      let start = bytes.length - MAX_HISTORY;
      while ((bytes[start] & 0xc0) === 0x80) start++;
      entry.text = bytes.subarray(start).toString('utf8');
      value.bytes = Buffer.byteLength(entry.text);
      value.truncated = true;
    }
  }

  function record(value, role, text) {
    if (!text) return;
    let entry = role === 'assistant' ? value.assistant : null;
    if (!entry || !value.history.includes(entry)) {
      entry = { role, text: '' };
      value.history.push(entry);
    }
    entry.text += text;
    value.bytes += Buffer.byteLength(text);
    value.assistant = role === 'assistant' ? entry : null;
    trimHistory(value);
    return entry;
  }

  function discardUnlanded(own) {
    const index = own.session.history.indexOf(own.entry);
    if (index >= 0 && !own.entry.landed) {
      removeEntry(own.session, own.entry);
      own.session.bytes -= Buffer.byteLength(own.entry.text);
      const last = own.session.history.at(-1);
      own.session.assistant = last?.role === 'assistant' ? last : null;
    }
  }

  function removeEntry(value, entry) {
    const index = value.history.indexOf(entry);
    value.history.splice(index, 1);
    const left = value.history[index - 1], right = value.history[index];
    if (left?.role === 'assistant' && right?.role === 'assistant') {
      left.text += right.text;
      value.history.splice(index, 1);
      if (value.assistant === right) value.assistant = left;
    }
  }

  function observeUser(value, text) {
    const match = value.history.find(entry => entry.pending && entry.text === text)
      ?? value.history.find(entry => entry.steer && entry.echoPending && entry.text === text)
      ?? value.history.find(entry => entry.echoPending && entry.text === text);
    if (!match) return record(value, 'user', text);
    match.echoPending = false;
    if (match.steer) {
      removeEntry(value, match);
      value.history.push(match);
      match.pending = false;
      match.landed = true;
      value.assistant = null;
    }
  }

  function observeParent(message) {
    if (!message || !Object.hasOwn(message, 'id') || typeof message.method !== 'string') return;
    const params = message.params ?? {};
    if (['session/new', 'session/load', 'session/resume'].includes(message.method)) {
      original.set(message.id, { method: message.method, sessionId: params.sessionId, cwd: params.cwd });
    } else if (message.method === 'session/prompt' && typeof params.sessionId === 'string') {
      const value = session(params.sessionId);
      value.active++;
      value.assistant = null;
      const entry = record(value, 'user', (Array.isArray(params.prompt) ? params.prompt : [])
        .filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n'));
      if (entry) entry.echoPending = true;
      original.set(message.id, { method: message.method, sessionId: params.sessionId });
    }
  }

  function observeChild(message) {
    if (!message || typeof message !== 'object') return;
    if (Object.hasOwn(message, 'id') && !message.method) {
      const own = owned.get(message.id);
      if (own) {
        owned.delete(message.id);
        clearTimeout(own.timer);
        if (message.error) {
          discardUnlanded(own);
          own.reject?.(new Error(message.error.message ?? 'ACP steering failed.'));
        }
        else if (message.result?.outcome === 'injected') {
          own.entry.pending = false;
          own.resolve?.({ delivered: true, outcome: 'injected' });
        } else {
          discardUnlanded(own);
          own.resolve?.({ delivered: false, outcome: message.result?.outcome ?? 'failed' });
        }
        return true;
      }
      const request = original.get(message.id);
      if (request) {
        original.delete(message.id);
        if (request.method === 'session/prompt') {
          const value = sessions.get(request.sessionId);
          if (value) {
            value.active = Math.max(0, value.active - 1);
            value.assistant = null;
            if (!value.active) for (const entry of value.history) entry.echoPending = false;
          }
        } else if (!message.error) {
          const id = message.result?.sessionId ?? request.sessionId;
          if (typeof id === 'string') session(id, request.cwd);
        }
      }
    }
    const params = message.params, update = params?.update;
    if (message.method === 'session/update' && typeof params?.sessionId === 'string'
      && ['agent_message_chunk', 'user_message_chunk'].includes(update?.sessionUpdate) && update.content?.type === 'text'
      && typeof update.content.text === 'string') {
      const value = session(params.sessionId);
      if (update.sessionUpdate === 'user_message_chunk') observeUser(value, update.content.text);
      else record(value, 'assistant', update.content.text);
    }
    return false;
  }

  function rejectPending(error) {
    for (const own of owned.values()) {
      clearTimeout(own.timer);
      own.reject?.(error);
      own.resolve = own.reject = null;
    }
  }

  async function dispatch(request) {
    const supplied = typeof request?.params?.token === 'string' ? Buffer.from(request.params.token) : Buffer.alloc(0);
    if (supplied.length !== token.length || !timingSafeEqual(supplied, token)) {
      throw Object.assign(new Error('Unauthorized bridge request.'), { code: -32001 });
    }
    if (stopping) throw new Error('The ACP provider is closing.');
    const params = request.params;
    if (request.method === 'list_sessions') return { sessions: [...sessions.values()].map(summary) };
    const value = sessions.get(params.sessionId);
    if (!value) throw Object.assign(new Error('Unknown live ACP session.'), { code: -32602 });
    if (request.method === 'read_session') return {
      ...summary(value), history: value.history.filter(entry => !entry.pending)
        .map(({ role, text }) => ({ role, text })), truncated: value.truncated,
    };
    if (request.method !== 'send_message') throw Object.assign(new Error('Method not found.'), { code: -32601 });
    if (typeof params.prompt !== 'string' || !params.prompt.trim() || params.prompt.length > 65536) {
      throw Object.assign(new Error('prompt must contain 1..65536 characters.'), { code: -32602 });
    }
    if (!value.active) return { delivered: false, outcome: 'idle' };
    return new Promise((resolve, reject) => {
      const id = 'webcodex-bridge-' + randomUUID();
      // Reserve the send boundary for v1 adapters that acknowledge a steer without echoing its user chunk.
      const entry = record(value, 'user', params.prompt);
      Object.assign(entry, { pending: true, steer: true, echoPending: true });
      const own = { resolve, reject, session: value, entry };
      // Keep timed-out IDs until their replies arrive so bridge responses never reach the Runner.
      own.timer = setTimeout(() => {
        reject(new Error('ACP steering timed out after dispatch; delivery is unknown. Read before resending.'));
        own.resolve = own.reject = null;
      }, 65000);
      owned.set(id, own);
      // shortcut: ACP steering is adapter-specific; revalidate after upgrading codex-acp.
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: '_session/steering', params: {
        sessionId: value.sessionId, prompt: [{ type: 'text', text: params.prompt }],
        _meta: { steering: { idleBehavior: 'promptRequired' } },
      } }) + '\n');
    });
  }

  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    let pending = Buffer.alloc(0);
    function respond(id, result, error) {
      if (socket.destroyed) return;
      const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, ...(error
        ? { error: { code: error.code ?? -32000, message: error.message } } : { result }) }));
      const header = Buffer.alloc(4);
      header.writeUInt32LE(payload.length);
      socket.write(Buffer.concat([header, payload]));
    }
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 4) {
        const length = pending.readUInt32LE(0);
        if (!length || length > MAX_FRAME) return socket.destroy();
        if (pending.length < length + 4) return;
        const payload = pending.subarray(4, length + 4);
        pending = pending.subarray(length + 4);
        let request;
        try {
          request = JSON.parse(payload.toString('utf8'));
          if (request?.jsonrpc !== '2.0' || !['string', 'number'].includes(typeof request.id)) {
            throw Object.assign(new Error('Invalid JSON-RPC request.'), { code: -32600 });
          }
        } catch (error) { respond(null, null, error); continue; }
        dispatch(request).then(result => respond(request.id, result), error => respond(request.id, null, error));
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
  server.on('error', error => { rejectPending(error); shutdown(); });
  child = spawn(process.execPath, [config.adapterPath], {
    env: { ...process.env, CODEX_PATH: config.codexPath }, stdio: ['pipe', 'pipe', 'inherit'],
  });
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const output = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  input.on('line', line => {
    if (stopping) return;
    try { observeParent(JSON.parse(line)); } catch { /* Preserve even malformed upstream traffic. */ }
    if (!child.stdin.write(line + '\n')) input.pause();
  });
  child.stdin.on('drain', () => { if (!stopping) input.resume(); });
  output.on('line', line => {
    let own = false;
    try { own = observeChild(JSON.parse(line)); } catch { /* Parsing must not disrupt the ACP relay. */ }
    if (!own && !process.stdout.write(line + '\n')) output.pause();
  });
  process.stdout.on('drain', () => output.resume());
  function shutdown() {
    if (stopping) return;
    stopping = true;
    input.close();
    process.stdin.pause();
    server.close();
    rejectPending(new Error('The ACP provider connection closed; pending delivery may be unknown.'));
    for (const socket of sockets) socket.destroy();
    child.stdin.end();
  }
  input.on('close', shutdown);
  input.on('error', shutdown);
  output.on('error', shutdown);
  process.stdout.on('error', shutdown);
  child.stdin.on('error', shutdown);
  child.on('error', error => { console.error('ACP adapter spawn failed:', error.message); process.exitCode = 1; shutdown(); });
  const closed = new Promise(resolve => child.on('close', (code, signal) => {
    shutdown();
    owned.clear();
    process.exitCode = code ?? (signal ? 1 : 0);
    resolve({ code, signal });
  }));
  return { pipe, child, server, closed };
}
