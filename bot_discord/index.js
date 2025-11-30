const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const axios = require("axios");
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Bot đang online 24/7!"));
app.listen(5000, "0.0.0.0", () => console.log("Server keep-alive đang chạy trên port 5000"));

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwPPRtBxzURgpw2WxStHEBRtt9E3TKM9S6vpAGlq1V8kSH6KY2z6c_DrKWoEKY36Mj4/exec";

// Hàm cắt text thành từng đoạn theo dòng (max 2000 ký tự mỗi đoạn)
function splitMessage(text) {
  const maxLength = 2000;
  const messages = [];
  const lines = text.split("\n");
  let currentMessage = "";

  for (const line of lines) {
    if ((currentMessage + line + "\n").length > maxLength) {
      if (currentMessage) messages.push(currentMessage.trim());
      currentMessage = line + "\n";
    } else {
      currentMessage += line + "\n";
    }
  }

  if (currentMessage) messages.push(currentMessage.trim());
  return messages;
}

client.once("ready", async () => {
  console.log(`Bot đã online: ${client.user.tag}`);

  const commands = [
    { name: "report", description: "Lấy báo cáo bug mới nhất" },
    { name: "info", description: "Xem thông tin liên quan" },
    { name: "data", description: "Gửi dữ liệu bug" },
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

  try {
    console.log("Đang đăng ký lệnh globally...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), {
      body: commands,
    });
    console.log("✅ Slash commands đã đăng ký! (Lệnh sẽ xuất hiện sau 1-2 phút)");
  } catch (err) {
    console.error("Lỗi đăng ký lệnh:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "report") {
      await interaction.reply("⏳ Đang lấy report...");

      try {
        const res = await axios.get(GAS_WEBHOOK_URL + "?cmd=report");
        let text = res.data;
        if (!text) text = "❌ Không nhận được report từ GAS";

        const messages = splitMessage(text);

        // Gửi message đầu tiên
        await interaction.editReply(messages[0]);

        // Gửi các message tiếp theo (nếu có)
        for (let i = 1; i < messages.length; i++) {
          await interaction.followUp(messages[i]);
        }
      } catch (err) {
        console.error(err);
        await interaction.editReply("❌ Lỗi khi gọi Google Web App!");
      }
    }

    if (interaction.commandName === "info") {
      await interaction.reply(
        "ℹ️ Link Google Sheet: https://docs.google.com/spreadsheets/d/1CtChubs-WxMZizjhGiaS7rEBqUc3BJCAHKE5zfIzaXU/edit?gid=0"
      );
    }

    if (interaction.commandName === "data") {
      await interaction.reply("📊 Dữ liệu bug được gửi thành công!");
    }
  } catch (err) {
    console.error("Lỗi interaction:", err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
