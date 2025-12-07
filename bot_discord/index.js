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

  // FIX 1: Loại bỏ xuống dòng trong title của link và sử dụng non-greedy match
  text = text.replace(/\[(.*?)\]\(([^)]+)\)/gs, (m, t, url) => {
    return `[${t.replace(/\n/g, " ")}](${url.trim()})`;
  });

  // FIX 2: Regex mới, nhận đủ []() link và text thường
  // Sử dụng (.*?) cho tiêu đề link
  const regex = /(\[.*?\]\([^)]+\))|([^\[]+)/gs;
  const tokens = [...text.matchAll(regex)].map((m) => m[0]);

  const parts = [];
  let chunk = "";

  // Chuyển sang vòng lặp tiêu chuẩn để có thể chỉnh sửa token
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]; // Use 'let' for potential modification
    
    if ((chunk + token).length > MAX_CHUNK_LENGTH) {
      if (chunk) {
        // NEW LOGIC: Ngăn chặn việc tách dấu chấm đầu dòng (bullet) khỏi nội dung
        // Kiểm tra xem chunk có kết thúc bằng ký hiệu danh sách không (\n + space + •/*/-)
        // và token tiếp theo có phải là nội dung danh sách (bắt đầu bằng link '[')
        const listPrefixRegex = /([\r\n]\s*[\-\*•]\s*)$/g;
        const match = chunk.match(listPrefixRegex);
        
        if (match && token.startsWith('[')) {
          // Lấy ra phần tiền tố (dấu chấm đầu dòng và xuống dòng)
          const prefix = match[0];
          
          // Cắt phần tiền tố khỏi chunk (trang cũ)
          chunk = chunk.slice(0, chunk.length - prefix.length);
          
          // Chuyển phần tiền tố lên đầu token (trang mới)
          token = prefix + token;
          tokens[i] = token; // Cập nhật token trong mảng
        }
        
        parts.push(chunk);
      }
      
      chunk = token; // Bắt đầu chunk mới với token đã được chỉnh sửa
      
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

    // ----------------------------------------------------
    // BƯỚC 1: Tách Tiêu đề (Trang 0) và Nội dung Chi tiết (Trang 1+)
    
    let reportTitle = "";
    let mainReportContent = text;
    
    const splitMarker = "II. Report test tính năng các brands:";
    
    // Regex tìm chính xác mẫu: (Nội dung trước **) **(II. Report test tính năng các brands:...)
    const exactSplitRegex = /([\s\S]*?)\*\*(\s*II\. Report test tính năng các brands:[\s\S]*)/i;

    const match = text.match(exactSplitRegex);
    
    if (match && match.length === 3) {
      reportTitle = match[1].trim(); 
      mainReportContent = match[2];

      // Lấy phần nội dung chi tiết (sau 'II. Report test tính năng các brands:')
      const detailContent = mainReportContent.substring(splitMarker.length).trim();
      
      // BƯỚC SỬA LỖI 1: Tái tạo tiêu đề mục II. in đậm và loại bỏ dấu ** đóng ở cuối nếu có.
      mainReportContent = `**${splitMarker}**\n${detailContent}`;
      
      if (mainReportContent.endsWith('**')) {
        mainReportContent = mainReportContent.slice(0, -2).trim();
      }

      // BƯỚC SỬA LỖI 2: Làm sạch Markdown và Áp dụng In Đậm Có Chọn Lọc
      
     // Tách nội dung để bảo toàn dấu ** của tiêu đề II
      const contentAfterTitle = mainReportContent.substring(mainReportContent.indexOf(splitMarker) + splitMarker.length);
      
      // 2a. Loại bỏ tất cả dấu ** không cần thiết trong phần chi tiết (để tránh lỗi in đậm ngược)
      let cleanedContent = contentAfterTitle.replace(/\*\*/g, '').trim();
      
      // 2b. ÁP DỤNG IN ĐẬM CHO TẤT CẢ CÁC TIÊU ĐỀ
      
      // In đậm '1. Các brands đang có issue:'
      cleanedContent = cleanedContent.replace(
        /^(1\. Các brands đang có issue:)/m, 
        '**$1**'
      );
      
      // In đậm '2. Các brands không có issue:'
      cleanedContent = cleanedContent.replace(
        /^(2\. Các brands không có issue:)/m, 
        '**$1**'
      );
      
      // In đậm 'Tên Brand - PC'
      // Regex tìm: Bất kỳ ký tự chữ cái/số/khoảng trắng nào theo sau là ' - PC'
      cleanedContent = cleanedContent.replace(
        /^([\w\sÀ-Ỹ]+ - PC)([\r\n]+)/gm, 
        '**$1**$2'
      );
      
      // 2c. Ghép lại (Tiêu đề mục II. in đậm + Nội dung đã làm sạch và in đậm có chọn lọc)
      mainReportContent = `**${splitMarker}**\n${cleanedContent}`;

    } else {
      reportTitle = "Không tìm thấy điểm neo 'II. Report test tính năng các brands:'. Dữ liệu có thể bị dồn.";
      mainReportContent = text.trim();
    }
    
    // ----------------------------------------------------

    // BƯỚC 2 & 3: Phân trang và Gửi Embeds (Giữ nguyên)
    const parts = splitMessagePreserveLinks(mainReportContent);

    const firstEmbed = {
      title: "📊 DAILY BUG REPORT",
      description: reportTitle, 
      color: 0x00a2ff,
    };

    const contentEmbeds = parts.map((chunk, index) => ({
      title: `📄 Trang ${index + 1}`,
      description: chunk,
      color: 0x00a2ff,
    }));

    const embeds = [firstEmbed, ...contentEmbeds]; 

    await interaction.editReply({ embeds: [embeds[0]] });

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
