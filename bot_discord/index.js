const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const axios = require("axios");
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Bot đang online 24/7!"));
app.listen(5000, "0.0.0.0", () =>
  console.log("Server keep-alive đang chạy trên port 5000"),
);

// Hàm self-ping để keep alive
setInterval(
  async () => {
    try {
      const url = process.env.REPLIT_URL || "http://localhost:5000";
      await axios.get(url);
    } catch (err) {
      // Ignore errors
    }
  },
  4 * 60 * 1000,
); // Ping mỗi 4 phút

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const GAS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwPPRtBxzURgpw2WxStHEBRtt9E3TKM9S6vpAGlq1V8kSH6KY2z6c_DrKWoEKY36Mj4/exec";

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

// Hàm để cắt text mà không làm hỏng Markdown hyperlink
function cutTextSafe(text, maxLength = 1024) {
  // Tìm tất cả các hyperlinks trong text
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let matches;
  let linkParts = [];
  
  // Lưu các link tìm được
  while ((matches = linkRegex.exec(text)) !== null) {
    linkParts.push(matches[0]);
  }

  // Cắt văn bản sao cho không cắt ở giữa một link
  let truncatedText = text.slice(0, maxLength);
  let lastIndex = maxLength;
  
  // Kiểm tra xem nếu cắt văn bản quá dài, có thể làm mất link, cần cắt lại sao cho không mất link
  linkParts.forEach((link) => {
    const linkStart = truncatedText.indexOf(link);
    const linkEnd = linkStart + link.length;

    if (linkStart !== -1 && linkEnd <= maxLength) {
      lastIndex = Math.max(lastIndex, linkEnd);
    }
  });

  // Cắt văn bản lại đến lastIndex
  truncatedText = text.slice(0, lastIndex);

  // Nếu văn bản đã được cắt, thêm dấu ba chấm
  if (truncatedText.length < text.length) {
    truncatedText += "...";
  }

  return truncatedText;
}

client.once("ready", async () => {
  console.log(`Bot đã online: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("report")
      .setDescription("Lấy báo cáo bug mới nhất"),
    new SlashCommandBuilder()
      .setName("info")
      .setDescription("Xem thông tin liên quan"),
    new SlashCommandBuilder()
      .setName("data")
      .setDescription("Gửi file dữ liệu bug")
      .addAttachmentOption((option) =>
        option
          .setName("file")
          .setDescription("File CSV hoặc Excel")
          .setRequired(true),
      ),
  ].map((cmd) => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

  try {
    console.log("Đang đăng ký lệnh globally...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), {
      body: commands,
    });
    console.log(
      "✅ Slash commands đã đăng ký! (Lệnh sẽ xuất hiện sau 1-2 phút)",
    );
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

    // Split và xử lý message
    const messages = splitMessage(text);

    // Tạo các field cho Embed
    const fields = [];
    for (const message of messages) {
      fields.push({
        name: "🔸 Report Part",
        value: cutTextSafe(message, 1024), // Cắt phần text nếu quá dài
      });
    }

    // Tạo Embed với các phần nội dung
    const embed = {
      title: "📊 DAILY BUG REPORT",
      color: 0x00a2ff,
      fields: fields,
      timestamp: new Date().toISOString(),
    };

    // Gửi Embed
    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error("Lỗi khi gọi GAS hoặc xử lý report:", err);
    try {
      await interaction.editReply("❌ Lỗi khi gọi Google Web App!");
    } catch (e) {
      // ignore if editReply fails
      console.error("editReply failed:", e);
    }
  }
}


    if (interaction.commandName === "info") {
      const embed = {
        title: "ℹ️ DATA INFO",
        color: 3447003,
        fields: [
          {
            name: "1. File data all bug",
            value:
              "[Link](https://docs.google.com/spreadsheets/d/1CtChubs-WxMZizjhGiaS7rEBqUc3BJCAHKE5zfIzaXU/edit?gid=0)",
          },
          {
            name: "2. Link download file CSV",
            value:
              "[Link](https://creqacom.atlassian.net/issues/?filter=13415&jql=project%20IN%20%28RBDA%2C%20RBMM%2C%20RBBK%2C%20RB18%2C%20RBCV%2C%20RBHG%2C%20RBTA88%2C%20RBTL%2C%20VOD%2C%20CHIV%2C%20XIT%2C%20BU88%2C%20KBET%2C%20AM%2C%20RUM%2C%20TIKI%2C%20DU%2C%20HO%2C%20BOM%2C%20GA%2C%20LAZ%2C%20TARO%2C%20VAB%2C%20LMN%2C%20SB88%2C%20S88%2C%20NEON%2C%20ROOS%2C%20SHOP%2C%20Q88%2C%20TH01%29%0AAND%20created%20%3E%3D%20-18h%0AAND%20type%20%3D%20Bug%0AAND%20status%20%21%3D%20Resolved%0AORDER%20BY%20created%20DESC)",
          },
          {
            name: "3. Link data daily function",
            value:
              "[Link](https://docs.google.com/spreadsheets/d/1KKnCq7666uE-Z-wE7JW0raE5OKh5dHKPX8eDlSGmlWs/edit?gid=476546611#gid=476546611)",
          },
        ],
        footer: { text: "Team gửi info" },
        timestamp: new Date().toISOString(),
      };

      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "data") {
      const file = interaction.options.getAttachment("file");
      if (!file) {
        await interaction.reply("❌ Vui lòng chọn file!");
        return;
      }

      await interaction.reply(
        `⏳ Đang gửi file ${file.name} lên Google Web App...`,
      );

      try {
        const res = await axios.post(GAS_WEBHOOK_URL, {
          cmd: "data",
          fileUrl: file.url,
        });

        await interaction.editReply(res.data.message || "✅ Dữ liệu được lưu!");
      } catch (err) {
        console.error(err);
        await interaction.editReply("❌ Lỗi khi gửi CSV lên Google Web App!");
      }
    }
  } catch (err) {
    console.error("Lỗi interaction:", err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
