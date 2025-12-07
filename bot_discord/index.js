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

// ====================================================================
// Hàm 1: splitMessagePreserveLinks (Dành cho Embed - Giới hạn 3500)
// ====================================================================
const MAX_EMBED_LENGTH = 3500; 

function splitMessagePreserveLinks(text) {
  const MAX_CHUNK_LENGTH = MAX_EMBED_LENGTH;

  // FIX 1: Loại bỏ xuống dòng trong title của link và sử dụng non-greedy match
  text = text.replace(/\[(.*?)\]\(([^)]+)\)/gs, (m, t, url) => {
    return `[${t.replace(/\n/g, " ")}](${url.trim()})`;
  });

  // FIX 2: Regex mới, nhận đủ []() link và text thường
  const regex = /(\[.*?\]\([^)]+\))|([^\[]+)/gs;
  const tokens = [...text.matchAll(regex)].map((m) => m[0]);

  const parts = [];
  let chunk = "";

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    
    const currentLimit = MAX_CHUNK_LENGTH;
    
    if ((chunk + token).length > currentLimit) {
      if (chunk) {
        // LOGIC: Ngăn chặn việc tách dấu chấm đầu dòng khỏi nội dung/link
        const listPrefixRegex = /([\r\n]\s*[\-\*•]\s*)$/g;
        const match = chunk.match(listPrefixRegex);
        
        if (match && token.startsWith('[')) {
          const prefix = match[0];
          chunk = chunk.slice(0, chunk.length - prefix.length);
          token = prefix + token;
          tokens[i] = token; 
        } 
        // Logic an toàn: giữ các khối tiêu đề/danh sách con không bị cắt lửng
        else if (token.trim().length > 1 && token.includes('\n')) { 
            const lastNewline = chunk.lastIndexOf('\n');
            if (lastNewline !== -1 && (currentLimit - lastNewline) < token.length + 50) {
                const remaining = chunk.substring(lastNewline).trim();
                chunk = chunk.slice(0, lastNewline);
                token = remaining + token;
                tokens[i] = token;
            }
        }
        
        parts.push(chunk);
      }
      
      chunk = token;
      
      // Xử lý trường hợp một token (link/text) quá dài
      if (token.length > currentLimit) {
        const subParts = token.match(new RegExp(`.{1,${currentLimit}}`, "gs")) || [];
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

// ====================================================================
// Hàm 2: splitMessageAvoidCuttingLinks (Dành cho Tin nhắn thường - Giới hạn 2000)
// ====================================================================
const MAX_DISCORD_MESSAGE_LENGTH = 1990; 

function splitMessageAvoidCuttingLinks(text) {
  const MAX_CHUNK_LENGTH = MAX_DISCORD_MESSAGE_LENGTH;

  // 1. Chuẩn hóa link (loại bỏ xuống dòng trong title)
  text = text.replace(/\[(.*?)\]\(([^)]+)\)/gs, (m, t, url) => {
    return `[${t.replace(/\n/g, " ")}](${url.trim()})`;
  });

  // 2. Tách chuỗi thành các token: link hoặc text thường
  const regex = /(\[.*?\]\([^)]+\))|([^\[]+)/gs;
  const tokens = [...text.matchAll(regex)].map((m) => m[0]);
  
  const parts = [];
  let chunk = "";

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]; // Sử dụng let để có thể thay đổi token
    
    if ((chunk + token).length > MAX_CHUNK_LENGTH) {
      if (chunk) {
        // LOGIC: NGĂN CHẶN CẮT DẤU ĐẦU DÒNG VÀO CHUNK TIẾP THEO
        const listPrefixRegex = /([\r\n]\s*[\-\*•]\s*)$/g;
        const match = chunk.match(listPrefixRegex);
        
        if (match && token.startsWith('[')) {
          const prefix = match[0];
          chunk = chunk.slice(0, chunk.length - prefix.length);
          token = prefix + token;
          tokens[i] = token; // Cập nhật token trong mảng
        }
        
        parts.push(chunk);
      }
      chunk = token;
      
      // Xử lý token quá dài (buộc phải cắt)
      while (chunk.length > MAX_CHUNK_LENGTH) {
        parts.push(chunk.substring(0, MAX_CHUNK_LENGTH));
        chunk = chunk.substring(MAX_CHUNK_LENGTH);
      }
    } else {
      // Thêm token vào chunk hiện tại
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
      .setDescription("Lấy báo cáo bug mới nhất (dạng Embed)"),
// === BỔ SUNG LỆNH /report1 ===
    new SlashCommandBuilder() 
      .setName("report1")
      .setDescription("Lấy báo cáo bug mới nhất (dạng Tin nhắn thường)"),
// =============================
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

  // --- HÀM XỬ LÝ FORMAT CHUNG (TÁCH NỘI DUNG thành 2 PHẦN: Mục I và Mục II) ---
const processReportContent = (text) => {
    let section1 = ""; // Tiêu đề + Mục I
    let section2 = ""; // Mục II + Chi tiết
    
    const splitMarker = "II. Report test tính năng các brands:";
    
    // Regex tìm chính xác mẫu: (Nội dung trước **) **(II. Report test tính năng các brands:...)
    const exactSplitRegex = /([\s\S]*?)\*\*(\s*II\. Report test tính năng các brands:[\s\S]*)/i;

    const match = text.match(exactSplitRegex);
    
    if (match && match.length === 3) {
        // Phần 1: Tiêu đề + Mục I (Loại bỏ các ký tự Markdown dư thừa)
        section1 = match[1].trim().replace(/\*\*/g, '').trim(); 
        
        // **BỔ SUNG LOGIC IN ĐẬM CHO PHẦN SECTION 1**
        // In đậm dòng "Team gửi..."
        section1 = section1.replace(/(Team gửi Anh\/Chị Report daily tối [\d-]+:)/i, '**$1**');
        // In đậm dòng "I. Report access domain tối: Link"
        section1 = section1.replace(/(I\. Report access domain tối: Link)/i, '**$1**');
        
        // Phần 2: Nội dung từ Mục II trở đi (Bao gồm dấu ** ban đầu)
        let rawSection2 = match[2];

        // Lấy phần nội dung chi tiết
        const detailContent = rawSection2.substring(splitMarker.length).trim();
        
        // Làm sạch Markdown dư thừa trong phần chi tiết
        let cleanedContent = detailContent.replace(/\*\*/g, '').trim();
        
        // ÁP DỤNG IN ĐẬM CHO CÁC TIÊU ĐỀ CON TRONG SECTION 2
        cleanedContent = cleanedContent.replace(/^(1\. Các brands đang có issue:)/m, '**$1**'); 
        cleanedContent = cleanedContent.replace(/^(Các brands đang có issue:)/m, '**$1**');
        cleanedContent = cleanedContent.replace(/^(2\. Các brands không có issue:)/m, '**$1**');
        cleanedContent = cleanedContent.replace(/^([\w\sÀ-Ỹ]+ - PC)([\r\n]+)/gm, '**$1**$2');
        
        // Tái tạo Mục II với dấu ** chính xác ở đầu
        section2 = `**${splitMarker}**\n${cleanedContent}`;

    } else {
        // Fallback: Nếu không tìm thấy Mục II, coi như toàn bộ là Section 1
        section1 = text.trim();
        section2 = ""; 
    }
    return { section1, section2 };
};
  // -------------------------------------------------------------------------

  try {
    // ===================== /report (DẠNG EMBED ĐÃ FIX CẮT MỤC I & II) =====================
if (interaction.commandName === "report") {
  await interaction.reply("⏳ Đang lấy report...");

  try {
    const res = await axios.get(GAS_WEBHOOK_URL + "?cmd=report");
    let text = res.data || "❌ Không nhận được report từ GAS";

    if (text.startsWith("❌")) {
      await interaction.editReply({ content: text });
      return;
    }
    
    // **TÁCH CHỦ ĐỘNG** Mục I và Mục II
    const { section1, section2 } = processReportContent(text); 

    // 1. Trang 0: Luôn chứa Tiêu đề + Mục I (section1)
    const firstEmbed = {
      title: "📊 DAILY BUG REPORT",
      description: section1,
      color: 0x00a2ff,
    };
    
    const embeds = [firstEmbed];

    // 2. Các trang tiếp theo: Dùng hàm cắt chuỗi an toàn cho Mục II (section2)
    if (section2) {
      const section2Parts = splitMessagePreserveLinks(section2);

      section2Parts.forEach((chunk, index) => {
        embeds.push({
            title: `📄 Trang ${index + 2}`, // Bắt đầu từ trang 2
            description: chunk,
            color: 0x00a2ff,
        });
      });
    }
    
    await interaction.editReply({ embeds: [embeds[0]] });

    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]] });
    }

  } catch (err) {
    console.error("Lỗi khi xử lý /report:", err);
    await interaction.editReply("❌ Lỗi khi gọi Google Web App!");
  }
}
    // ===================== /report1 (DẠNG TIN NHẮN THƯỜNG ĐÃ SỬA LỖI CẮT LINK) =====================
    if (interaction.commandName === "report1") {
      await interaction.reply("⏳ Đang lấy report (Tin nhắn thường)...");
      
      try {
        const res = await axios.get(GAS_WEBHOOK_URL + "?cmd=report");
        let text = res.data || "❌ Không nhận được report từ GAS";

        if (text.startsWith("❌")) {
            await interaction.editReply({ content: text });
            return;
        }

        // Xử lý format (in đậm tiêu đề, giữ hyperlink)
        const { section1, section2 } = processReportContent(text);
        
        // Gộp lại toàn bộ nội dung đã format
        const fullFormattedText = section1 + "\n" + section2;

        // **SỬ DỤNG HÀM CHIA CHUỖI AN TOÀN CHO TIN NHẮN THƯỜNG (1990)**
        const parts = splitMessageAvoidCuttingLinks(fullFormattedText);

        if (parts.length > 0) {
          // Gửi phần đầu tiên, DƯỚI DẠNG TIN NHẮN THƯỜNG
          await interaction.editReply({ content: parts[0] });

          // Gửi phần còn lại, DƯỚI DẠNG TIN NHẮN THƯỜNG
          for (let i = 1; i < parts.length; i++) {
            await interaction.followUp({ content: parts[i] });
          }
        } else {
          await interaction.editReply("❌ Report rỗng.");
        }

      } catch (err) {
        console.error("Lỗi khi xử lý /report1:", err);
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
        console.error("Lỗi khi xử lý /data:", err);
        await interaction.editReply("❌ Lỗi khi gửi CSV lên Google Web App!");
      }
    }
  } catch (err) {
    console.error("Lỗi interaction tổng thể:", err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
