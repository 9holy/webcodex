import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import { callDesktop, dispatch, nativeRpc } from './bridge.mjs';

async function withPipe(reply, check) {
  const pipe = '\\\\.\\pipe\\bridge-check-' + process.pid;
  const server = net.createServer(socket => socket.once('data', () => reply(socket)));
  await new Promise(resolve => server.listen(pipe, resolve));
  try { await check(pipe); } finally { await new Promise(resolve => server.close(resolve)); }
}
function frame(message) {
  const payload = Buffer.from(JSON.stringify(message)), header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length);
  return Buffer.concat([header, payload]);
}

await withPipe(socket => {
  const bytes = frame({ jsonrpc: '2.0', id: 1, result: { text: '收到中文回复' } });
  socket.write(bytes.subarray(0, 2));
  setImmediate(() => socket.end(bytes.subarray(2)));
}, async pipe => assert.deepEqual(await nativeRpc(pipe, 'read', {}), { text: '收到中文回复' }));
await withPipe(socket => socket.end(frame({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'rejected' } })),
  async pipe => assert.rejects(nativeRpc(pipe, 'send', {}), /rejected/));
await withPipe(socket => socket.destroy(),
  async pipe => assert.rejects(nativeRpc(pipe, 'send', {}), /outcome is unknown/));
await withPipe(socket => { const header = Buffer.alloc(4); header.writeUInt32LE(8 * 1024 * 1024 + 1); socket.end(header); },
  async pipe => assert.rejects(nativeRpc(pipe, 'read', {}), /exceeds 8 MiB/));

const tools = JSON.parse(fs.readFileSync(new URL('./tools.json', import.meta.url), 'utf8'));
const originalThread = process.env.CODEX_THREAD_ID;
delete process.env.CODEX_THREAD_ID;
try { await assert.rejects(callDesktop('list_threads', {}), /real caller thread/); }
finally { if (originalThread !== undefined) process.env.CODEX_THREAD_ID = originalThread; }
const catalog = await dispatch({ method: 'tools/list' }, {}, tools);
assert.equal(catalog.tools.length, 6);
assert(catalog.tools.every(tool => !('target' in tool) && !('remoteName' in tool)));
assert(!catalog.tools.some(tool => /create|delete|cancel|archive|wait/.test(tool.name)));
const sendSchema = catalog.tools.find(tool => tool.name === 'codex_send_message_to_thread').inputSchema;
assert(!Object.hasOwn(sendSchema.properties, 'model'));
assert(!Object.hasOwn(sendSchema.properties, 'thinking'));
for (const override of ['model', 'thinking']) {
  await assert.rejects(callDesktop('send_message_to_thread', {
    threadId: 'test-session', prompt: 'test', [override]: 'unsupported',
  }), /preserves the target chat model/);
}
assert.equal((await dispatch({ method: 'initialize', params: { protocolVersion: '2025-03-26' } }, {}, tools)).protocolVersion, '2025-03-26');
await assert.rejects(dispatch({ method: 'tools/call', params: { name: 'arbitrary_tool' } }, {}, tools), /Unknown tool/);
const badTarget = await dispatch({ method: 'tools/call', params: { name: 'webcodex_send_message', arguments: {
  connectionId: '../other-pipe', sessionId: 'anything', prompt: 'test',
} } }, { bridgeTokenFile: new URL('./test-bridge.mjs', import.meta.url) }, tools);
assert.equal(badTarget.isError, true);
assert.match(badTarget.content[0].text, /exact connectionId/);
console.log('Bridge checks passed: framed UTF-8, remote errors, unknown delivery, frame bounds, restricted MCP catalog and target validation.');
