// TESTE TEMPORÁRIO DO DUELO (pode apagar depois).
// Parte 1: simula uma partida num banco de teste separado (não toca no roleta.db).
// Parte 2: posta um convite de teste no grupo dos ganhadores e apaga em 10 s.

require("dotenv").config();

const os = require("os");
const fs = require("fs");
const path = require("path");

const bancoTeste = path.join(os.tmpdir(), "teste-duelo.db");
for (const sufixo of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(bancoTeste + sufixo); } catch {}
}
process.env.MEMORIA_DB_PATH = bancoTeste;

const duelo = require("./services/jogo-memoria-duelo");
const Database = require("better-sqlite3");
const db = new Database(bancoTeste);

function liberarVez(codigo) {
    db.prepare("UPDATE memoria_duelos SET vez_inicio = ? WHERE codigo = ?")
        .run(Date.now() - 1, codigo);
}

function parte1() {
    console.log("=== PARTE 1: partida simulada ===");

    const A = "111", B = "222", C = "333";

    const criado = duelo.criar(A);
    console.log("A convidou:", criado.ok, criado.codigo);
    console.log("A convidou de novo (deve ser aguarde):", duelo.criar(A).motivo);

    const codigo = criado.codigo;
    console.log("B entrou:", duelo.entrar(B, codigo).status);
    console.log("C tentou entrar (deve ser ja_entraram):", duelo.entrar(C, codigo).motivo);

    liberarVez(codigo);

    const cartas = JSON.parse(
        db.prepare("SELECT cartas_json FROM memoria_duelos WHERE codigo = ?")
            .get(codigo).cartas_json
    );

    let estado = duelo.estado(A, codigo);
    const daVez = () => (estado.vez === 1 ? A : B);

    // erra de propósito: a vez tem que passar
    const errada = cartas.findIndex((c, i) => i > 0 && c.par !== cartas[0].par);
    const antes = estado.vez;
    duelo.jogar(daVez(), codigo, 0);
    estado = duelo.jogar(daVez(), codigo, errada);
    console.log("Errou, a vez passou:", antes !== estado.vez);

    liberarVez(codigo);

    // quem está na vez acha todos os pares
    const pares = {};
    cartas.forEach((c, i) => (pares[c.par] = pares[c.par] || []).push(i));

    for (const [i1, i2] of Object.values(pares)) {
        const quem = daVez();
        duelo.jogar(quem, codigo, i1);
        estado = duelo.jogar(quem, codigo, i2);
        if (estado.status !== "jogando") break;
    }

    console.log(
        "Fim:", estado.status,
        "| vencedor:", estado.vencedor,
        "| pontos:", estado.jogadores.map(j => j.pontos).join(" x ")
    );
    console.log("Ranking de duelos:", duelo.listarRanking().map(
        r => `${r.posicao}º ${r.usuarioId} (${r.vitorias} vitória)`
    ).join(", "));
}

async function parte2() {
    console.log("\n=== PARTE 2: convite no grupo ===");

    const { Bot } = require("node-telegram-bot-api");
    const bot = new Bot(process.env.BOT_TOKEN);
    const link = `${process.env.MINI_APP_LINK}?startapp=duelo_TESTE`;

    const mensagem = await bot.api.sendMessage({
        chat_id: process.env.GANHADORES_CHAT_ID,
        text: "Teste do convite de duelo. Some em 10 segundos.",
        reply_markup: {
            inline_keyboard: [[{ text: "Entrar na partida", url: link }]]
        }
    });

    console.log("Postou. chat:", mensagem.chat.id, "| mensagem:", mensagem.message_id);

    await new Promise(r => setTimeout(r, 10000));

    await bot.api.deleteMessage({
        chat_id: mensagem.chat.id,
        message_id: mensagem.message_id
    });

    console.log("Apagou.");
}

try {
    parte1();
} catch (erro) {
    console.error("ERRO NA PARTE 1:", erro);
}

parte2()
    .catch(erro => console.error("ERRO NA PARTE 2:", erro))
    .finally(() => process.exit(0));
