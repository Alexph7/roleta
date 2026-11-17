// Jogo da Memória - modo solo conferido pelo servidor.
// O servidor guarda as cartas e conta as jogadas,
// assim o ranking solo não aceita resultado inventado.

const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const caminhoBanco =
    process.env.MEMORIA_DB_PATH ||
    path.join(__dirname, "..", "roleta.db");

const db = new Database(caminhoBanco);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

const TOTAL_CARTAS = 48;
const TOTAL_PARES = TOTAL_CARTAS / 2;

const EMOJIS = [
    0x1F34E, 0x1F349, 0x1F680, 0x1F31F, 0x1F381, 0x1F984,
    0x1F43C, 0x1F355, 0x26BD, 0x1F308, 0x1F438, 0x1F431,
    0x1F436, 0x1F354, 0x1F388, 0x1F3C6, 0x1F6B2, 0x1F3B8,
    0x1F353, 0x1F419, 0x1F33B, 0x1F369, 0x1F98A, 0x1F3AE
].map(codigo => String.fromCodePoint(codigo));

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria_solo_partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        cartas_json TEXT NOT NULL,
        pares_json TEXT NOT NULL DEFAULT '[]',
        selecionada_indice INTEGER,
        jogadas INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ativa',
        iniciada_em INTEGER NOT NULL,
        primeira_carta_em INTEGER,
        concluida_em INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_memoria_solo_usuario
        ON memoria_solo_partidas (usuario_id, status);

    CREATE INDEX IF NOT EXISTS idx_memoria_solo_ranking
        ON memoria_solo_partidas (status, jogadas);
`);

function embaralhar(lista) {
    const resultado = [...lista];

    for (let i = resultado.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }

    return resultado;
}

function criarCartas() {
    const pares = EMOJIS.map((emoji, par) => ({ par, emoji }));
    return embaralhar(pares.flatMap(item => [item, item]));
}

function lerAtiva(usuarioId) {
    return db.prepare(`
        SELECT * FROM memoria_solo_partidas
        WHERE usuario_id = ? AND status = 'ativa'
        ORDER BY id DESC
        LIMIT 1
    `).get(String(usuarioId));
}

function nomeDoUsuario(usuarioId) {
    try {
        const linha = db.prepare(`
            SELECT nome_exibicao FROM usuarios WHERE usuario_id = ?
        `).get(String(usuarioId));

        return linha?.nome_exibicao || "Jogador";
    } catch {
        return "Jogador";
    }
}

// Melhor partida de cada pessoa: menos jogadas,
// empate decidido pelo menor tempo.
const SQL_MELHORES = `
    WITH melhores AS (
        SELECT
            usuario_id,
            jogadas,
            (concluida_em - primeira_carta_em) AS tempo_ms,
            concluida_em,
            ROW_NUMBER() OVER (
                PARTITION BY usuario_id
                ORDER BY jogadas ASC,
                         (concluida_em - primeira_carta_em) ASC,
                         id ASC
            ) AS ordem
        FROM memoria_solo_partidas
        WHERE status = 'concluida'
    ),
    ranking AS (
        SELECT
            usuario_id,
            jogadas,
            tempo_ms,
            ROW_NUMBER() OVER (
                ORDER BY jogadas ASC, tempo_ms ASC, concluida_em ASC
            ) AS posicao
        FROM melhores
        WHERE ordem = 1
    )
`;

function resultadoUsuario(usuarioId) {
    const linha = db.prepare(`
        ${SQL_MELHORES}
        SELECT * FROM ranking WHERE usuario_id = ?
    `).get(String(usuarioId));

    if (!linha) return null;

    return {
        posicao: Number(linha.posicao),
        jogadas: Number(linha.jogadas),
        tempoMs: Number(linha.tempo_ms)
    };
}

function listarRanking(limite = 50) {
    const limiteSeguro = Math.max(
        1,
        Math.min(100, Math.trunc(Number(limite) || 50))
    );

    const linhas = db.prepare(`
        ${SQL_MELHORES}
        SELECT * FROM ranking ORDER BY posicao ASC LIMIT ?
    `).all(limiteSeguro);

    return linhas.map(linha => ({
        posicao: Number(linha.posicao),
        usuarioId: String(linha.usuario_id),
        nome: nomeDoUsuario(linha.usuario_id),
        jogadas: Number(linha.jogadas),
        tempoMs: Number(linha.tempo_ms)
    }));
}

// ==============================
// INICIAR
// ==============================

const iniciarTransaction = db.transaction((usuarioId, agora) => {
    const ativa = lerAtiva(usuarioId);

    // Partida sem nenhuma carta virada é reaproveitada.
    if (ativa && ativa.primeira_carta_em === null) {
        return { ok: true, totalCartas: TOTAL_CARTAS, totalPares: TOTAL_PARES };
    }

    // Partida começada e largada: fica como abandonada.
    if (ativa) {
        db.prepare(`
            UPDATE memoria_solo_partidas
            SET status = 'abandonada'
            WHERE id = ?
        `).run(ativa.id);
    }

    db.prepare(`
        INSERT INTO memoria_solo_partidas (usuario_id, cartas_json, iniciada_em)
        VALUES (?, ?, ?)
    `).run(usuarioId, JSON.stringify(criarCartas()), agora);

    return { ok: true, totalCartas: TOTAL_CARTAS, totalPares: TOTAL_PARES };
});

function iniciar(usuarioId) {
    return iniciarTransaction.immediate(String(usuarioId), Date.now());
}

// ==============================
// JOGADA
// ==============================

const jogarTransaction = db.transaction((usuarioId, indice, agora) => {
    const partida = lerAtiva(usuarioId);

    if (!partida) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    const cartas = JSON.parse(partida.cartas_json);
    const indiceSeguro = Math.trunc(Number(indice));

    if (
        !Number.isInteger(indiceSeguro) ||
        indiceSeguro < 0 ||
        indiceSeguro >= cartas.length
    ) {
        return { ok: false, motivo: "indice_invalido" };
    }

    const pares = JSON.parse(partida.pares_json || "[]");

    if (pares.includes(cartas[indiceSeguro].par)) {
        return { ok: false, motivo: "carta_ja_encontrada" };
    }

    // ---------- PRIMEIRA CARTA ----------

    if (partida.selecionada_indice === null) {
        db.prepare(`
            UPDATE memoria_solo_partidas
            SET selecionada_indice = ?,
                primeira_carta_em = COALESCE(primeira_carta_em, ?)
            WHERE id = ?
        `).run(indiceSeguro, agora, partida.id);

        return {
            ok: true,
            tipo: "primeira",
            indice: indiceSeguro,
            emoji: cartas[indiceSeguro].emoji
        };
    }

    if (partida.selecionada_indice === indiceSeguro) {
        return { ok: false, motivo: "mesma_carta" };
    }

    // ---------- SEGUNDA CARTA ----------

    const primeiroIndice = partida.selecionada_indice;
    const combinou = cartas[primeiroIndice].par === cartas[indiceSeguro].par;
    const jogadas = partida.jogadas + 1;
    const novosPares = combinou
        ? [...pares, cartas[primeiroIndice].par]
        : pares;
    const terminou = novosPares.length === TOTAL_PARES;

    db.prepare(`
        UPDATE memoria_solo_partidas
        SET pares_json = ?,
            selecionada_indice = NULL,
            jogadas = ?,
            status = ?,
            concluida_em = ?
        WHERE id = ?
    `).run(
        JSON.stringify(novosPares),
        jogadas,
        terminou ? "concluida" : "ativa",
        terminou ? agora : null,
        partida.id
    );

    return {
        ok: true,
        tipo: "segunda",
        combinou,
        cartas: [
            { indice: primeiroIndice, emoji: cartas[primeiroIndice].emoji },
            { indice: indiceSeguro, emoji: cartas[indiceSeguro].emoji }
        ],
        jogadas,
        paresEncontrados: novosPares.length,
        terminou,
        tempoMs: terminou ? agora - partida.primeira_carta_em : null,
        meuResultado: terminou ? resultadoUsuario(usuarioId) : null
    };
});

function jogar(usuarioId, indice) {
    return jogarTransaction.immediate(String(usuarioId), indice, Date.now());
}

module.exports = {
    iniciar,
    jogar,
    listarRanking,
    resultadoUsuario
};
