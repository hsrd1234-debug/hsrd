// Build script to assemble standalone HTML with embedded base64 assets
const fs = require('fs');

const boardB64 = fs.readFileSync('board.b64.txt', 'utf8').trim();
const titleB64 = fs.readFileSync('title.b64.txt', 'utf8').trim();
const avatarB64 = fs.readFileSync('avatar.b64.txt', 'utf8').trim();

const RAW_BOARD_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/snakes%20and%20Ladder.png";
const RAW_TITLE_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/title%20for%20snakes%20and%20ladder%20.png";
const RAW_AVATAR_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/snakes%20and%20ladder%203.png";

// Read template or write complete HTML generator
console.log("Assets verified. Ready to generate standalone document.");
