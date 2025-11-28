// ---------------- IMPORT ----------------
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const express = require('express');

// ---------------- ENV ----------------
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;  // Set trong Replit Secrets
const APPLICATION_ID = process.env.APPLICATION_ID;        // Set trong Replit Secrets
const GUILD_ID = process.env.GUILD_ID;                    // Set trong Replit Secrets

// ---------------- BOT CLIENT ----------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Bot đã online với tên: ${client.user.tag}`);

  // --- Đăng ký slash commands ---
  const commands = [
    { name: 'report', description: 'Lấy báo cáo bug mới nhất' },
    { name: 'info', description: 'Xem thông tin dữ liệu & link liên quan' },
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  (async () => {
    try {
      console.log('Đang đăng ký lệnh cho server...');
      await rest.put(
        Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
        { body: commands }
      );
      console.log('Đăng ký lệnh xong!');
    } catch (error) {
      if (error.code === 50001) {
        console.log('\n⚠️  LỖI QUYỀN: Bot chưa có quyền đăng ký slash commands.');
        console.log('📋 Vui lòng mời lại bot với link sau:');
        console.log(`   https://discord.com/api/oauth2/authorize?client_id=${APPLICATION_ID}&permissions=2147483648&scope=bot%20applications.commands`);
        console.log('\n✅ Bot vẫn đang online, chỉ slash commands chưa hoạt động.\n');
      } else {
        console.error(error);
      }
    }
  })();
});

// --- Xử lý slash commands ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'report') {
    await interaction.reply('Đây là báo cáo bug mới nhất!');
  } else if (commandName === 'info') {
    await interaction.reply('Thông tin dữ liệu & link liên quan: ...');
  }
});

// ---------------- LOGIN BOT ----------------
client.login(DISCORD_BOT_TOKEN);

// ---------------- EXPRESS KEEP-ALIVE ----------------
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Bot đang online 24/7!');
});

app.listen(PORT, () => {
  console.log(`Server keep-alive đang chạy trên port ${PORT}`);
});
