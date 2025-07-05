// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = 80;
const USERS_DIR = path.join(__dirname, 'usuarios');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(express.static('public'));
app.use('/usuarios', express.static(USERS_DIR));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configurar upload de imagem
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(USERS_DIR, 'imagens'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Criar diretórios se não existirem
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR);
}
if (!fs.existsSync(path.join(USERS_DIR, 'imagens'))){
  fs.mkdirSync(path.join(USERS_DIR, 'imagens'));
}
if (!fs.existsSync(path.join(USERS_DIR, 'token'))){
  fs.mkdirSync(path.join(USERS_DIR, 'token'));
}

// Função para gerar token aleatório de 256 caracteres
function generateToken(length = 256) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// Rota de recebimento do formulário
app.post('/submit', upload.single('petImage'), async (req, res) => {
  const { petName, ownerName, phone, social } = req.body;
  const petImage = req.file ? req.file.filename : null;

  // Obter ID incremental
  const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));
  const id = files.length > 0 ? Math.max(...files.map(f => parseInt(f))) + 1 : 1;

  const token = generateToken();

  const userData = {
    id,
    petName,
    ownerName,
    phone,
    social,
    petImage,
    token
  };

  fs.writeFileSync(path.join(USERS_DIR, `${id}.json`), JSON.stringify(userData, null, 2));

  // Gerar QR Code
  const qrLink = `http://palpet.xyz:${PORT}/${token}`;
  const qrPath = path.join(USERS_DIR, 'token', `${id}.png`);
  await QRCode.toFile(qrPath, qrLink);

  res.send('Informações salvas com sucesso!');
});

// Rota para exibir dados do usuário por token
app.get('/:token', (req, res) => {
  const token = req.params.token;
  const files = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));

  let userData = null;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(USERS_DIR, file)));
    if (data.token === token) {
      userData = data;
      break;
    }
  }

  if (!userData) {
    return res.status(404).send('<h1>Usuário não encontrado</h1>');
  }

  const imagePath = userData.petImage ? `/usuarios/imagens/${userData.petImage}` : '';

  const templatePath = path.join(PUBLIC_DIR, 'id.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  html = html.replace('{{petName}}', userData.petName)
             .replace('{{ownerName}}', userData.ownerName)
             .replace('{{phone}}', userData.phone)
             .replace('{{social}}', userData.social)
             .replace('{{imagePath}}', imagePath);

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
