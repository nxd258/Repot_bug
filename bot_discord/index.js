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
  console.log("Server keep-alive đang chạy trên port 5000")
);

// Self-ping để giữ bot alive
setInterval(async () => {
  try {
    const url = process.env.REPLIT_URL || "http://localhost:5000";
    await axios.get(url);
  } catch (err) {}
}, 4 * 60 * 1000);

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const GAS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwPPRtBxzURgpw2WxStHEBRtt9E3TKM9S6vpAGlq1V8kSH6KY2z6c_DrKWoEKY36Mj4/exec";

// Hàm cắt text dài thành từng đoạn nhỏ, bảo toàn Markdown links
const MAX_EMBED_LENGTH = 3500; // an toàn hơn 4000

function splitMessagePreserveLinks(text) {
  // Sử dụng hằng số an toàn đã định nghĩa
  const MAX_CHUNK_LENGTH = MAX_EMBED_LENGTH; 

  // FIX 1: Loại bỏ xuống dòng trong title của link
  // SỬA: Dùng (.*?) thay vì (.+?) để tăng tính ổn định khi tiêu đề link phức tạp (có dấu ] hoặc [ bên trong)
  text = text.replace(/\[(.*?)\]\(([^)]+)\)/gs, (m, t, url) => {
    return `[${t.replace(/\n/g, " ")}](${url.trim()})`;
  });

  // FIX 2: Regex mới, nhận đủ []() link và text thường
  // SỬA: Dùng (.*?) thay vì (.+?) cho tiêu đề link
  const regex = /(\[.*?\]\([^)]+\))|([^\[]+)/gs;
  const tokens = [...text.matchAll(regex)].map((m) => m[0]);

  const parts = [];
  let chunk = "";

  for (const token of tokens) {
    if ((chunk + token).length > MAX_CHUNK_LENGTH) {
      if (chunk) parts.push(chunk);
      chunk = token;
      // Xử lý trường hợp một token (ví dụ: một link rất dài) vẫn vượt quá giới hạn
      if (token.length > MAX_CHUNK_LENGTH) {
        const subParts = token.match(new RegExp(`.{1,${MAX_CHUNK_LENGTH}}`, "gs")) || [];
        parts.push(...subParts.slice(0, -1));
        chunk = subParts[subParts.length - 1];
      }
    } else {
      chunk += token;
    }
  }

  if (chunk) parts.push(chunk);
  return parts;
}




// Đăng ký slash commands
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
      .addAttachmentOption((op) =>
        op
          .setName("file")
          .setDescription("File CSV hoặc Excel")
          .setRequired(true)
      ),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);
  try {
    console.log("Đang đăng ký lệnh globally...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), {
      body: commands,
    });
    console.log("✅ Slash commands đã đăng ký!");
  } catch (err) {
    console.error("Lỗi đăng ký lệnh:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // ===================== /report (ĐÃ SỬA DỤNG HÀM CHUẨN) =====================
   if (interaction.commandName === "report") {
  await interaction.reply("⏳ Đang lấy report...");

  try {
    const res = await axios.get(GAS_WEBHOOK_URL + "?cmd=report");
    let text = res.data || "❌ Không nhận được report từ GAS";

    // SỬ DỤNG HÀM CHUẨN ĐỂ CHIA TEXT, BẢO TOÀN LINKS
    const parts = splitMessagePreserveLinks(text); 
    
    // Discord Embed cho phép tối đa 4096 ký tự cho description, nhưng 
    // hàm splitMessagePreserveLinks sử dụng 3500 để an toàn và tránh 
    // các lỗi nhỏ về byte.

    const embeds = parts.map((chunk, index) => ({
      title: index === 0 ? "📊 DAILY BUG REPORT" : `📄 Trang ${index + 1}`,
      description: chunk,
      color: 0x00a2ff,
    }));

    // Gửi embed đầu tiên
    await interaction.editReply({ embeds: [embeds[0]] });

    // Gửi phần còn lại
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]] });
    }

  } catch (err) {
    console.error(err);
    await interaction.editReply("❌ Lỗi khi gọi Google Web App!");
  }
}

    // ===================== /info =====================
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
              "[Link](https://creqacom.atlassian.net/issues/?filter=13415&jql=project%20IN%20(RBDA,RBMM,RBBK,RB18,RBCV,RBHG,RBTA88,RBTL,VOD,CHIV,XIT,BU88,KBET,AM,RUM,TIKI,DU,HO,BOM,GA,LAZ,TARO,VAB,LMN,SB88,S88,NEON,ROOS,SHOP,Q88,TH01)%20AND%20created%20%3E%3D%20-18h%20AND%20type%20%3D%20Bug%20AND%20status%20!%3D%20Resolved%20ORDER%20BY%20created%20DESC)",
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

    // ===================== /data =====================
    if (interaction.commandName === "data") {
      const file = interaction.options.getAttachment("file");
      if (!file) {
        await interaction.reply("❌ Vui lòng chọn file!");
        return;
      }

      await interaction.reply(
        `⏳ Đang gửi file ${file.name} lên Google Web App...`
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
