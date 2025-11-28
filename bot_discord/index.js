const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const APPLICATION_ID = process.env.APPLICATION_ID || '';
const GUILD_ID = process.env.GUILD_ID || '';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', () => {
  console.log(`Bot đã online với tên: ${client.user.tag}`);

  const commands = [
    { name: 'report', description: 'Lấy báo cáo bug mới nhất' },
    { name: 'info', description: 'Xem thông tin dữ liệu & link liên quan' },
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  (async () => {
    try {
      console.log('Đang đăng ký lệnh cho server...');
      await rest.put(
        Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
        { body: commands },
      );
      console.log('Đăng ký lệnh xong!');
    } catch (error) {
      console.error(error);
    }
  })();
});

client.login(process.env.DISCORD_BOT_TOKEN);
