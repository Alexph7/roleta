const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const caminhoBanco =
    process.env.MEMORIA_DB_PATH ||
    path.join(__dirname, "..", "roleta.db");

const db = new Database(caminhoBanco);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// ==============================
// CONFIGURAÇÃO
// ==============================

const CAMPANHA = "memoria_ranking_20261015";
const TAMANHO = 6;
const TOTAL_PARES = (TAMANHO * TAMANHO) / 2;
const PREMIO = "R$ 10";
const QTD_PREMIADOS = 5;

// Fim do jogo. Para mudar, defina MEMORIA_FIM_EM no .env,
// por exemplo: MEMORIA_FIM_EM=2026-10-16T21:00:00-03:00
const FIM_PADRAO = "2026-10-15T21:00:00-03:00";

let FIM_EM = Date.parse(
    process.env.MEMORIA_FIM_EM || FIM_PADRAO
);

if (!Number.isFinite(FIM_EM)) {
    FIM_EM = Date.parse(FIM_PADRAO);
}

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

// ==============================
// TABELAS
// ==============================

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria_rank_partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campanha TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        numero_partida INTEGER NOT NULL,
        cartas_json TEXT NOT NULL,
        pares_encontrados_json TEXT NOT NULL DEFAULT '[]',
        selecionada_indice INTEGER,
        jogadas INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ativa',
        iniciada_em INTEGER NOT NULL,
        primeira_carta_em INTEGER,
        concluida_em INTEGER,
        abandonada_em INTEGER,
        UNIQUE (campanha, usuario_id, numero_partida)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_memoria_rank_uma_ativa
        ON memoria_rank_partidas (campanha, usuario_id)
        WHERE status = 'ativa';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_memoria_rank_uma_concluida
        ON memoria_rank_partidas (campanha, usuario_id)
        WHERE status = 'concluida';

    CREATE INDEX IF NOT EXISTS idx_memoria_rank_ordem
        ON memoria_rank_partidas (
            campanha,
            status,
            numero_partida,
            jogadas,
            concluida_em
        );

    CREATE TABLE IF NOT EXISTS memoria_rank_premiados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campanha TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        premio TEXT NOT NULL,
        posicao INTEGER NOT NULL,
        criado_em INTEGER NOT NULL,
        UNIQUE (campanha, usuario_id)
    );
`);

// ==============================
// AUXILIARES
// ==============================

function jogoEncerrado(agora = Date.now()) {
    return agora >= FIM_EM;
}

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

function lerAtiva(usuarioId) {
    return db.prepare(`
        SELECT *
        FROM memoria_rank_partidas
        WHERE campanha = ?
          AND usuario_id = ?
          AND status = 'ativa'
        LIMIT 1
    `).get(CAMPANHA, String(usuarioId));
}

function lerConcluida(usuarioId) {
    return db.prepare(`
        SELECT *
        FROM memoria_rank_partidas
        WHERE campanha = ?
          AND usuario_id = ?
          AND status = 'concluida'
        LIMIT 1
    `).get(CAMPANHA, String(usuarioId));
}

function contarPartidas(usuarioId) {
    return db.prepare(`
        SELECT COUNT(*) AS total
        FROM memoria_rank_partidas
        WHERE campanha = ?
          AND usuario_id = ?
    `).get(CAMPANHA, String(usuarioId)).total;
}

function contarAbandonadas(usuarioId) {
    return db.prepare(`
        SELECT COUNT(*) AS total
        FROM memoria_rank_partidas
        WHERE campanha = ?
          AND usuario_id = ?
          AND status = 'abandonada'
    `).get(CAMPANHA, String(usuarioId)).total;
}

// Uma partida só vale como "começada" depois que a
// primeira carta foi virada. Se estiver começada e o
// jogador voltar sem ter concluído, vira abandonada.
function fecharAbandonadas(usuarioId, agora) {
    const resultado = db.prepare(`
        UPDATE memoria_rank_partidas
        SET status = 'abandonada',
            abandonada_em = ?
        WHERE campanha = ?
          AND usuario_id = ?
          AND status = 'ativa'
          AND primeira_carta_em IS NOT NULL
    `).run(agora, CAMPANHA, String(usuarioId));

    return resultado.changes > 0;
}

function resultadoUsuario(usuarioId) {
    const linha = db.prepare(`
        WITH r AS (
            SELECT
                usuario_id,
                numero_partida,
                jogadas,
                ROW_NUMBER() OVER (
                    ORDER BY
                        numero_partida ASC,
                        jogadas ASC,
                        concluida_em ASC,
                        id ASC
                ) AS posicao
            FROM memoria_rank_partidas
            WHERE campanha = ?
              AND status = 'concluida'
        )
        SELECT *
        FROM r
        WHERE usuario_id = ?
    `).get(CAMPANHA, String(usuarioId));

    if (!linha) {
        return null;
    }

    return {
        posicao: Number(linha.posicao),
        numeroPartida: Number(linha.numero_partida),
        jogadas: Number(linha.jogadas),
        premiado: Number(linha.posicao) <= QTD_PREMIADOS
    };
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
        numeroPartida: partida.numero_partida,
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
        jogadas: partida.jogadas,
        status: partida.status,
        concluidaEm: partida.concluida_em || null,
        fimEm: FIM_EM,
        ...extras
    };
}

// ==============================
// ESTADO (ANTES DE COMEÇAR)
// ==============================

const estadoTransaction = db.transaction((usuarioId, agora) => {
    const id = String(usuarioId);
    const encerrado = jogoEncerrado(agora);

    const concluida = lerConcluida(id);

    if (concluida) {
        return {
            encerrado,
            fimEm: FIM_EM,
            jaConcluiu: true,
            abandonou: false,
            partidasAbandonadas: contarAbandonadas(id),
            proximaPartida: null,
            meuResultado: resultadoUsuario(id),
            premio: PREMIO,
            qtdPremiados: QTD_PREMIADOS
        };
    }

    // Quem volta para a tela de regras não está
    // mais jogando. Partida começada vira abandonada.
    const abandonou = fecharAbandonadas(id, agora);

    const ativa = lerAtiva(id);

    const proximaPartida = ativa
        ? ativa.numero_partida
        : contarPartidas(id) + 1;

    return {
        encerrado,
        fimEm: FIM_EM,
        jaConcluiu: false,
        abandonou,
        partidasAbandonadas: contarAbandonadas(id),
        proximaPartida,
        meuResultado: null,
        premio: PREMIO,
        qtdPremiados: QTD_PREMIADOS
    };
});

function estado(usuarioId) {
    return estadoTransaction.immediate(
        String(usuarioId),
        Date.now()
    );
}

// ==============================
// INICIAR PARTIDA
// ==============================

const iniciarTransaction = db.transaction((usuarioId, agora) => {
    const id = String(usuarioId);

    const concluida = lerConcluida(id);

    if (concluida) {
        return {
            ok: true,
            ...estadoPublico(concluida),
            meuResultado: resultadoUsuario(id)
        };
    }

    if (jogoEncerrado(agora)) {
        return {
            ok: false,
            motivo: "encerrado"
        };
    }

    fecharAbandonadas(id, agora);

    let ativa = lerAtiva(id);

    // Partida criada mas sem nenhuma carta virada
    // é reaproveitada: não conta como tentativa.
    if (!ativa) {
        const numero = contarPartidas(id) + 1;

        const resultado = db.prepare(`
            INSERT INTO memoria_rank_partidas (
                campanha,
                usuario_id,
                numero_partida,
                cartas_json,
                iniciada_em
            ) VALUES (?, ?, ?, ?, ?)
        `).run(
            CAMPANHA,
            id,
            numero,
            JSON.stringify(criarCartas()),
            agora
        );

        ativa = db.prepare(`
            SELECT * FROM memoria_rank_partidas WHERE id = ?
        `).get(resultado.lastInsertRowid);
    }

    return {
        ok: true,
        ...estadoPublico(ativa)
    };
});

function iniciar(usuarioId) {
    return iniciarTransaction.immediate(
        String(usuarioId),
        Date.now()
    );
}

// ==============================
// JOGADA
// ==============================

const jogarTransaction = db.transaction((usuarioId, indice, agora) => {
    const id = String(usuarioId);

    const concluida = lerConcluida(id);

    if (concluida) {
        return {
            ok: true,
            ...estadoPublico(concluida),
            meuResultado: resultadoUsuario(id),
            jaConcluida: true
        };
    }

    if (jogoEncerrado(agora)) {
        return {
            ok: false,
            motivo: "encerrado"
        };
    }

    const partida = lerAtiva(id);

    if (!partida) {
        return {
            ok: false,
            motivo: "partida_inexistente"
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

    // ---------- PRIMEIRA CARTA DO PAR ----------

    if (partida.selecionada_indice === null) {
        db.prepare(`
            UPDATE memoria_rank_partidas
            SET selecionada_indice = ?,
                primeira_carta_em = COALESCE(
                    primeira_carta_em,
                    ?
                )
            WHERE id = ?
        `).run(indiceSeguro, agora, partida.id);

        return {
            ok: true,
            tipo: "primeira",
            indice: indiceSeguro,
            emoji: cartas[indiceSeguro].emoji,
            ...estadoPublico(partida, {
                indiceSelecionado: indiceSeguro,
                emojiSelecionado: cartas[indiceSeguro].emoji
            })
        };
    }

    if (partida.selecionada_indice === indiceSeguro) {
        return {
            ok: false,
            motivo: "mesma_carta"
        };
    }

    // ---------- SEGUNDA CARTA DO PAR ----------

    const primeiroIndice = partida.selecionada_indice;
    const primeiro = cartas[primeiroIndice];
    const segundo = cartas[indiceSeguro];
    const combinou = primeiro.par === segundo.par;
    const jogadas = partida.jogadas + 1;

    let novaListaPares = paresEncontrados;

    if (combinou) {
        novaListaPares = [...paresEncontrados, primeiro.par];
    }

    const terminou = novaListaPares.length === TOTAL_PARES;

    db.prepare(`
        UPDATE memoria_rank_partidas
        SET pares_encontrados_json = ?,
            selecionada_indice = NULL,
            jogadas = ?,
            status = ?,
            concluida_em = ?
        WHERE id = ?
    `).run(
        JSON.stringify(novaListaPares),
        jogadas,
        terminou ? "concluida" : "ativa",
        terminou ? agora : null,
        partida.id
    );

    const atualizada = db.prepare(`
        SELECT * FROM memoria_rank_partidas WHERE id = ?
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
        meuResultado: terminou ? resultadoUsuario(id) : null
    };
});

function jogar(usuarioId, indice) {
    return jogarTransaction.immediate(
        String(usuarioId),
        indice,
        Date.now()
    );
}

// ==============================
// RANKING
// ==============================

function listarRanking(limite = 20) {
    const limiteSeguro = Math.max(
        1,
        Math.min(100, Math.trunc(Number(limite) || 20))
    );

    const linhas = db.prepare(`
        SELECT
            p.usuario_id,
            COALESCE(u.nome_exibicao, 'Participante') AS nome,
            p.numero_partida,
            p.jogadas,
            ROW_NUMBER() OVER (
                ORDER BY
                    p.numero_partida ASC,
                    p.jogadas ASC,
                    p.concluida_em ASC,
                    p.id ASC
            ) AS posicao
        FROM memoria_rank_partidas p
        LEFT JOIN usuarios u
            ON u.usuario_id = p.usuario_id
        WHERE p.campanha = ?
          AND p.status = 'concluida'
        ORDER BY posicao ASC
        LIMIT ?
    `).all(CAMPANHA, limiteSeguro);

    const total = db.prepare(`
        SELECT COUNT(*) AS total
        FROM memoria_rank_partidas
        WHERE campanha = ?
          AND status = 'concluida'
    `).get(CAMPANHA).total;

    return {
        ranking: linhas.map(linha => ({
            usuarioId: String(linha.usuario_id),
            nome: linha.nome,
            posicao: Number(linha.posicao),
            numeroPartida: Number(linha.numero_partida),
            jogadas: Number(linha.jogadas),
            premiado: Number(linha.posicao) <= QTD_PREMIADOS
        })),
        totalConcluidos: Number(total)
    };
}

// ==============================
// PREMIAÇÃO (DEPOIS DO FIM)
// ==============================

const premiarTransaction = db.transaction((agora) => {
    const jaPremiou = db.prepare(`
        SELECT COUNT(*) AS total
        FROM memoria_rank_premiados
        WHERE campanha = ?
    `).get(CAMPANHA).total;

    if (jaPremiou > 0) {
        return [];
    }

    const top = db.prepare(`
        SELECT
            p.usuario_id,
            u.first_name,
            u.username,
            ROW_NUMBER() OVER (
                ORDER BY
                    p.numero_partida ASC,
                    p.jogadas ASC,
                    p.concluida_em ASC,
                    p.id ASC
            ) AS posicao
        FROM memoria_rank_partidas p
        LEFT JOIN usuarios u
            ON u.usuario_id = p.usuario_id
        WHERE p.campanha = ?
          AND p.status = 'concluida'
        ORDER BY posicao ASC
        LIMIT ?
    `).all(CAMPANHA, QTD_PREMIADOS);

    const inserir = db.prepare(`
        INSERT OR IGNORE INTO memoria_rank_premiados (
            campanha,
            usuario_id,
            premio,
            posicao,
            criado_em
        ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const linha of top) {
        inserir.run(
            CAMPANHA,
            String(linha.usuario_id),
            PREMIO,
            Number(linha.posicao),
            agora
        );
    }

    return top.map(linha => ({
        usuario_id: String(linha.usuario_id),
        first_name: linha.first_name,
        username: linha.username,
        posicao: Number(linha.posicao),
        premio: PREMIO
    }));
});

// Devolve os premiados UMA única vez, depois do fim.
function premiarSeEncerrado() {
    const agora = Date.now();

    if (!jogoEncerrado(agora)) {
        return [];
    }

    return premiarTransaction.immediate(agora);
}

function obterEstado(usuarioId) {
    const partida = lerAtiva(usuarioId) || lerConcluida(usuarioId);
    return partida ? estadoPublico(partida) : null;
}

module.exports = {
    CAMPANHA,
    PREMIO,
    QTD_PREMIADOS,
    FIM_EM,
    estado,
    iniciar,
    jogar,
    listarRanking,
    resultadoUsuario,
    premiarSeEncerrado,
    obterEstado
};