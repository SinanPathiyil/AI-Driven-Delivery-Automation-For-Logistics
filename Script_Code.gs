function generateDeliveryList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nftSheet = ss.getSheetByName('NFT_Ownership');
  const userSheet = ss.getSheetByName('User_Addresses');
  const outputSheet = ss.getSheetByName('Delivery_Ready');

  const today = new Date();
  const nftData = nftSheet.getDataRange().getValues();
  const userData = userSheet.getDataRange().getValues();

  const headers = ['User_Name', 'Crop_Type', 'Address', 'Phone', 'Delivery_Date'];
  const output = [headers];


  for (let i = 1; i < nftData.length; i++) {
    const [walletId, , cropType, harvestDate] = nftData[i];
    const hDate = new Date(harvestDate);

    if (hDate <= today) {
      const userRow = userData.find(row => row[0] === walletId);
      if (userRow) {
        const [, userName, phone, address] = userRow;
        output.push([userName, cropType, address, phone, new Date().toDateString()]);
      }
    }
  }

  outputSheet.clearContents();
  outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
} 

function appendToWeeklyLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const deliverySheet = ss.getSheetByName('Delivery_Ready');
  const logSheet = ss.getSheetByName('Weekly_Log');

  const deliveryData = deliverySheet.getDataRange().getValues();
  const logData = logSheet.getDataRange().getValues();

  // Indices of columns we need: assuming these are columns A-D (0 to 3)
  const COL_USER = 0;
  const COL_CROP = 1;
  const COL_ADDRESS = 2;
  const COL_DATE = 4;

  // Create a set of existing entries to avoid duplicates
  const existingRows = new Set(logData.map(row => row.join("|")));
  const newRows = [];

  for (let i = 1; i < deliveryData.length; i++) {
    const row = deliveryData[i];
    const filteredRow = [row[COL_USER], row[COL_CROP], row[COL_ADDRESS], row[COL_DATE]];
    const rowKey = filteredRow.join("|");

    if (!existingRows.has(rowKey)) {
      newRows.push(filteredRow);
    }
  }

  if (newRows.length > 0) {
    logSheet.getRange(logData.length + 1, 1, newRows.length, 4).setValues(newRows);
  }
}



function generateWeeklySummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Weekly_Log');
  const data = sheet.getDataRange().getValues();

  let prompt = `Here is a table of weekly shipment logs from Nori Farm:\n\nUser_Name | Crop_Type | Address | Delivery_Date\n`;

  for (let i = 1; i < data.length; i++) {
    prompt += `${data[i][0]} | ${data[i][1]} | ${data[i][2]} | ${data[i][3]}\n`;
  }

  prompt += `\nPlease summarize the following:
1. Total deliveries made
2. Most commonly shipped crop
3. States with the highest deliveries
4. Any missing/incomplete data (if any)`;

  // ✅ Use your Groq API Key here
  const apiKey = "gsk_--------------------------------------------3FYpoEU2lfFtoKC8HCUByZH84EQ";
  const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

  const payload = {
    model: "llama3-8b-8192",  // Use a Groq-supported model
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  };

  const groqOptions = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiKey
    },
    payload: JSON.stringify(payload)
  };

  const groqResponse = UrlFetchApp.fetch(groqUrl, groqOptions);
  const groqJson = JSON.parse(groqResponse.getContentText());
  const summary = groqJson.choices[0].message.content;

  // ✅ Send summary to Telegram
  const telegramToken = "75------------------------------------------6ns2jb0";
  const chatId = "505-----14";
  const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  const telegramOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text: `📦 *Nori Farm - Weekly Delivery Summary*\n\n${summary}`,
      parse_mode: "Markdown"
    })
  };

  UrlFetchApp.fetch(telegramUrl, telegramOptions);

  // ✅ Clear the old data (keep the header row)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
}



function exportAndSendCSVToTelegram() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cropSheet = ss.getSheetByName("NFT_Ownership");
  const userSheet = ss.getSheetByName("User_Addresses");

  if (!cropSheet || !userSheet) {
    SpreadsheetApp.getUi().alert("❌ One or both sheets are missing! Ensure the tabs are named 'NFT_Ownership' and 'User_Addresses'.");
    return;
  }

  const cropData = cropSheet.getDataRange().getValues();
  const userData = userSheet.getDataRange().getValues();

  // 🗺️ Build wallet → user info map
  const walletMap = {};
  for (let i = 1; i < userData.length; i++) {
    const row = userData[i];
    walletMap[row[0]] = [row[1], row[2], row[3]]; // [User_Name, Phone, Address]
  }

  // 📅 Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 📦 Start CSV
  let csv = "User_Name,Phone,Address,Crop_Type,Quantity,Harvest_Date\n";

  for (let i = 1; i < cropData.length; i++) {
    const [walletId, , cropType, harvestDateStr, quantity] = cropData[i];
    const hDate = new Date(harvestDateStr);
    hDate.setHours(0, 0, 0, 0);

    if (hDate <= today) {
      const userInfo = walletMap[walletId];
      if (userInfo) {
        const [userName, phone, address] = userInfo;
        csv += `${userName},${phone},${address},${cropType},${quantity},${harvestDateStr}\n`;
      }
    }
  }

  // 📤 Create CSV blob
  const blob = Utilities.newBlob(csv, 'text/csv', 'Delivery_Ready.csv');

  // 📬 Telegram setup
  const telegramToken = "7505-------------------------------s2jb0";
  const chatId = "50------------4";
  const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendDocument`;

  const formData = {
    method: "post",
    payload: {
      chat_id: chatId,
      caption: "📦 *Nori Farm - Delivery Batch (Ready Crops)*",
      document: blob.setName("Delivery_Ready.csv"),
      parse_mode: "Markdown"
    }
  };

  UrlFetchApp.fetch(telegramUrl, formData);

}
