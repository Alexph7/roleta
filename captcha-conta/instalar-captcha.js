// Execute na pasta do projeto: node captcha-conta/instalar-captcha.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = process.cwd();
const arquivos = ['index.js', 'public/app.js', 'public/index.html'];
const originais = arquivos.map(f => fs.readFileSync(path.join(root, f), 'utf8'));
let [server, app, html] = originais;
const jaInstalado = server.includes("require('./services/captcha-pontos-servidor')");
if (!jaInstalado) {
const rota = /app\.post\(\s*(["'])\/api\/girar-pontos\1\s*,/;
if (!rota.test(server)) throw new Error('Rota de pontos não encontrada. Nenhum arquivo alterado.');
server = server.replace(rota, `const criarCaptchaPontos = require('./services/captcha-pontos-servidor');
const captchaPontos = criarCaptchaPontos({ validarInitDataTelegram, usuarioLiberadoPorId, salvarUsuarioTelegram, obterPeriodoDiarioAtual });
app.post('/api/girar-pontos', captchaPontos,`);
const chamada = /await\s+fetch\(\s*["']\/api\/girar-pontos["']\s*,\s*\{\s*method\s*:\s*["']POST["']\s*,\s*headers\s*:\s*\{\s*["']Content-Type["']\s*:\s*["']application\/json["']\s*\}\s*,\s*body\s*:\s*JSON\.stringify\(\s*\{\s*initData\s*\}\s*\)\s*\}\s*\)/g;
if ([...app.matchAll(chamada)].length !== 1) throw new Error('Chamada do giro diferente da versão analisada. Nenhum arquivo alterado.');
app = app.replace(chamada, 'await window.girarPontosComCaptcha(initData)');
}
const tagApp = /<script\b[^>]*\bsrc=["']app\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/;
if (!tagApp.test(html) || !html.includes('</head>')) throw new Error('Tags HTML não encontradas. Nenhum arquivo alterado.');
if (!html.includes('captcha-pontos.css')) html = html.replace('</head>', '<link rel="stylesheet" href="captcha-pontos.css?v=1">\n</head>');
if (!html.includes('captcha-pontos.js')) html = html.replace(tagApp, '<script src="captcha-pontos.js?v=1"></script>\n<script src="app.js?v=captcha-1"></script>');
html = html.replace(/captcha-pontos\.js\?[^"']*/g, 'captcha-pontos.js?v=conta-2').replace(/captcha-pontos\.css\?[^"']*/g, 'captcha-pontos.css?v=conta-2');
new vm.Script(server); new vm.Script(app);
const backup = path.join(root, 'backup-captcha-' + Date.now());
fs.mkdirSync(backup);
for (let i = 0; i < arquivos.length; i++) {
    const alvo = path.join(backup, arquivos[i]);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, originais[i]);
}
for (const [nome, pasta] of [['captcha-pontos-servidor.js', 'services'], ['captcha-pontos.js', 'public'], ['captcha-pontos.css', 'public']]) {
    const destino = path.join(root, pasta, nome);
    if (fs.existsSync(destino)) fs.copyFileSync(destino, path.join(backup, nome));
}
for (const [nome, pasta] of [['captcha-pontos-servidor.js', 'services'], ['captcha-pontos.js', 'public'], ['captcha-pontos.css', 'public']]) {
    fs.copyFileSync(path.join(__dirname, nome), path.join(root, pasta, nome));
}
[server, app, html].forEach((conteudo, i) => fs.writeFileSync(path.join(root, arquivos[i]), conteudo));
console.log('Instalado. Backup: ' + backup);
console.log('Reinicie apenas o bot. Conta simples ativa por padrão; CAPTCHA_PONTOS_ATIVO=false desliga. Não precisa de chaves.');
