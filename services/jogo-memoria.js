const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const caminhoBanco = path.join(__dirname, "..", "roleta.db");
const db = new Database(caminhoBanco);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

const CAMPANHA = "evento_memoria_20261010_6x6";
const TAMANHO = 6;
const TOTAL_PARES = (TAMANHO * TAMANHO) / 2;
const PREMIO = "R$ 10";
const ESTOQUE_INICIAL = 10;

const EMOJIS = [
    String.fromCodePoint(0x1F34E),
    String.fromCodePoint(0x1F349),
    String.fromCodePoint(0x1F680),
    String.fromCodePoint(0x1F31F),
    String.fromCodePoint(0x1F381),
    String.fromCodePoint(0x1F984),
    String.fromCodePoint(0x1F43C),
    String.fromCodePoint(0x1F355),
    String.fromCodePoint(0x26BD),
    String.fromCodePoint(0x1F308),
    String.fromCodePoint(0x1F438),
    String.fromCodePoint(0x1F431),
    String.fromCodePoint(0x1F436),
    String.fromCodePoint(0x1F354),
    String.fromCodePoint(0x1F388),
    String.fromCodePoint(0x1F3C6),
    String.fromCodePoint(0x1F6B2),
    String.fromCodePoint(0x1F3B8)
];

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria_partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campanha TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        cartas_json TEXT NOT NULL,
        pares_encontrados_json TEXT NOT NULL DEFAULT '[]',
        selecionada_indice INTEGER,
        tentativas INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ativa',
        premio TEXT,
        premio_ganho INTEGER NOT NULL DEFAULT 0,
        iniciada_em INTEGER NOT NULL,
        concluida_em INTEGER,
        UNIQUE (campanha, usuario_id)
    );

    CREATE TABLE IF NOT EXISTS memoria_estoque (
        campanha TEXT NOT NULL,
        premio TEXT NOT NULL,
        quantidade_inicial INTEGER NOT NULL,
        quantidade_restante INTEGER NOT NULL,
        atualizado_em INTEGER NOT NULL,
        PRIMARY KEY (campanha, premio)
    );

    CREATE TABLE IF NOT EXISTS memoria_ganhadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campanha TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        premio TEXT NOT NULL,
        ordem INTEGER NOT NULL,
        concluida_em INTEGER NOT NULL,
        UNIQUE (campanha, usuario_id),
        UNIQUE (campanha, ordem)
    );
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
    const pares = EMOJIS.map((emoji, par) => ({
        par,
        emoji
    }));

    return embaralhar(
        pares.flatMap(item => [item, item])
    );
}

function lerPartida(usuarioId) {
    return db.prepare(`
        SELECT *
        FROM memoria_partidas
        WHERE campanha = ? AND usuario_id = ?
        LIMIT 1
    `).get(CAMPANHA, String(usuarioId));
}

function estadoPublico(partida, extras = {}) {
    const cartas = JSON.parse(partida.cartas_json);
    const paresEncontrados = JSON.parse(
        partida.pares_encontrados_json || "[]"
    );

    const indicesEncontrados = cartas
        .map((carta, indice) =>
            paresEncontrados.includes(carta.par) ? indice : null
        )
        .filter(indice => indice !== null);

    const cartasEncontradas = indicesEncontrados.map(indice => ({
        indice,
        emoji: cartas[indice].emoji
    }));

    const indiceSelecionado =
        partida.selecionada_indice === null
            ? null
            : partida.selecionada_indice;

    return {
        partidaId: partida.id,
        tamanho: TAMANHO,
        totalCartas: TAMANHO * TAMANHO,
        totalPares: TOTAL_PARES,
        paresEncontrados: paresEncontrados.length,
        indicesEncontrados,
        cartasEncontradas,
        indiceSelecionado,
        emojiSelecionado:
            indiceSelecionado === null
                ? null
                : cartas[indiceSelecionado].emoji,
        tentativas: partida.tentativas,
        status: partida.status,
        premio: partida.premio || null,
        premioGanho: partida.premio_ganho === 1,
        concluidaEm: partida.concluida_em || null,
        ...extras
    };
}

const iniciarTransaction = db.transaction((usuarioId, agora) => {
    const existente = lerPartida(usuarioId);

    if (existente) {
        return estadoPublico(existente);
    }

    db.prepare(`
        INSERT OR IGNORE INTO memoria_estoque (
            campanha,
            premio,
            quantidade_inicial,
            quantidade_restante,
            atualizado_em
        ) VALUES (?, ?, ?, ?, ?)
    `).run(
        CAMPANHA,
        PREMIO,
        ESTOQUE_INICIAL,
        ESTOQUE_INICIAL,
        agora
    );

    const cartas = criarCartas();

    const resultado = db.prepare(`
        INSERT OR IGNORE INTO memoria_partidas (
            campanha,
            usuario_id,
            cartas_json,
            iniciada_em
        ) VALUES (?, ?, ?, ?)
    `).run(
        CAMPANHA,
        String(usuarioId),
        JSON.stringify(cartas),
        agora
    );

    return estadoPublico(
        db.prepare(`
            SELECT * FROM memoria_partidas WHERE id = ?
        `).get(resultado.lastInsertRowid)
    );
});

function iniciar(usuarioId) {
    return iniciarTransaction.immediate(
        String(usuarioId),
        Date.now()
    );
}

const jogarTransaction = db.transaction((usuarioId, indice, agora) => {
    const partida = lerPartida(usuarioId);

    if (!partida) {
        return {
            ok: false,
            motivo: "partida_inexistente"
        };
    }

    if (partida.status === "concluida") {
        return {
            ok: true,
            ...estadoPublico(partida),
            jaConcluida: true
        };
    }

    const indiceSeguro = Math.trunc(Number(indice));
    const cartas = JSON.parse(partida.cartas_json);

    if (
        !Number.isInteger(indiceSeguro) ||
        indiceSeguro < 0 ||
        indiceSeguro >= cartas.length
    ) {
        return {
            ok: false,
            motivo: "indice_invalido"
        };
    }

    const paresEncontrados = JSON.parse(
        partida.pares_encontrados_json || "[]"
    );

    if (paresEncontrados.includes(cartas[indiceSeguro].par)) {
        return {
            ok: false,
            motivo: "carta_ja_encontrada"
        };
    }

    if (partida.selecionada_indice === null) {
        db.prepare(`
            UPDATE memoria_partidas
            SET selecionada_indice = ?
            WHERE id = ?
        `).run(indiceSeguro, partida.id);

        return {
            ok: true,
            tipo: "primeira",
            indice: indiceSeguro,
            emoji: cartas[indiceSeguro].emoji,
            ...estadoPublico(partida, {
                indiceSelecionado: indiceSeguro
            })
        };
    }

    if (partida.selecionada_indice === indiceSeguro) {
        return {
            ok: false,
            motivo: "mesma_carta"
        };
    }

    const primeiroIndice = partida.selecionada_indice;
    const primeiro = cartas[primeiroIndice];
    const segundo = cartas[indiceSeguro];
    const combinou = primeiro.par === segundo.par;
    const tentativas = partida.tentativas + 1;

    let novoStatus = partida.status;
    let premio = null;
    let premioGanho = false;
    let concluidaEm = null;
    let novaListaPares = paresEncontrados;

    if (combinou) {
        novaListaPares = [...paresEncontrados, primeiro.par];
    }

    if (novaListaPares.length === TOTAL_PARES) {
        novoStatus = "concluida";
        concluidaEm = agora;

        const baixa = db.prepare(`
            UPDATE memoria_estoque
            SET quantidade_restante = quantidade_restante - 1,
                atualizado_em = ?
            WHERE campanha = ?
              AND premio = ?
              AND quantidade_restante > 0
        `).run(agora, CAMPANHA, PREMIO);

        if (baixa.changes === 1) {
            premio = PREMIO;
            premioGanho = true;

            const ordem = db.prepare(`
                SELECT COUNT(*) + 1 AS ordem
                FROM memoria_ganhadores
                WHERE campanha = ?
            `).get(CAMPANHA).ordem;

            db.prepare(`
                INSERT INTO memoria_ganhadores (
                    campanha,
                    usuario_id,
                    premio,
                    ordem,
                    concluida_em
                ) VALUES (?, ?, ?, ?, ?)
            `).run(
                CAMPANHA,
                String(usuarioId),
                PREMIO,
                ordem,
                agora
            );
        }
    }

    db.prepare(`
        UPDATE memoria_partidas
        SET pares_encontrados_json = ?,
            selecionada_indice = NULL,
            tentativas = ?,
            status = ?,
            premio = ?,
            premio_ganho = ?,
            concluida_em = ?
        WHERE id = ?
    `).run(
        JSON.stringify(novaListaPares),
        tentativas,
        novoStatus,
        premio,
        premioGanho ? 1 : 0,
        concluidaEm,
        partida.id
    );

    const atualizada = db.prepare(`
        SELECT * FROM memoria_partidas WHERE id = ?
    `).get(partida.id);

    return {
        ok: true,
        tipo: "segunda",
        combinou,
        cartas: [
            {
                indice: primeiroIndice,
                emoji: primeiro.emoji
            },
            {
                indice: indiceSeguro,
                emoji: segundo.emoji
            }
        ],
        aguardarMs: combinou ? 0 : 900,
        ...estadoPublico(atualizada),
        premio,
        premioGanho,
        premiosEsgotados:
            novoStatus === "concluida" && !premioGanho
    };
});

function jogar(usuarioId, indice) {
    return jogarTransaction.immediate(
        String(usuarioId),
        indice,
        Date.now()
    );
}

function obterEstado(usuarioId) {
    const partida = lerPartida(usuarioId);
    return partida ? estadoPublico(partida) : null;
}

module.exports = {
    CAMPANHA,
    iniciar,
    jogar,
    obterEstado
};