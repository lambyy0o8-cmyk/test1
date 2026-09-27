const RPC = require('discord-rpc');
const clientId = '1553470723027378176';
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
  console.log('RPC подключён');
  rpc.setActivity({
    details: 'Использует ZeroScript',
    state: 'MCP: vscode, discord',
    startTimestamp: new Date(),
    largeImageKey: 'zeroscrip',
    largeImageText: 'ZeroScript',
    instance: false,
  });
});

rpc.login({ clientId }).catch(console.error);

process.on('SIGINT', () => { rpc.destroy(); process.exit(0); });
