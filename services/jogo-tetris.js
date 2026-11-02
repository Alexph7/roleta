const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

// O mesmo motor que roda no celular. O servidor usa ele para refazer
// a partida e conferir a pontuacao.
const Motor = require("../public/tetris-motor.js");

const caminhoBanco =
    process.env.TETRIS_DB_PATH ||
    path.join(__dirname, "..", "roleta.db");

const db = new Database(caminhoBanco);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// Ninguem coloca uma peca em menos que isso. Abaixo disso, e robo ou fraude.
const MIN_MS_POR_PECA = 120;
const MAX_DURACAO_MS = 6 * 60 * 60 * 1000;
const MAX_PACOTE = 6100;

db.exec(`
    CREATE TABLE IF NOT EXISTS tetris_partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        seed INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativa',
        pontos INTEGER NOT NULL DEFAULT 0,
        linhas INTEGER NOT NULL DEFAULT 0,
        pecas INTEGER NOT NULL DEFAULT 0,
        duracao_ms INTEGER,
        acoes TEXT,
        iniciada_em INTEGER NOT NULL,
        finalizada_em INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tetris_uma_ativa
        ON tetris_partidas (usuario_id)
        WHERE status = 'ativa';

    CREATE INDEX IF NOT EXISTS idx_tetris_rank
        ON tetris_partidas (status, pontos DESC, finalizada_em);
`);

// ==============================
// INICIAR
// ==============================

const iniciarTransaction = db.transaction((usuarioId, agora) => {
    // Partida anterior que ficou aberta nao vale mais.
    db.prepare(`
        UPDATE tetris_partidas
        SET status = 'abandonada'
        WHERE usuario_id = ?
          AND status = 'ativa'
    `).run(usuarioId);

    const seed = crypto.randomInt(1, 2147483647);

    const resultado = db.prepare(`
        INSERT INTO tetris_partidas (usuario_id, seed, iniciada_em)
        VALUES (?, ?, ?)
    `).run(usuarioId, seed, agora);

    return {
        ok: true,
        partidaId: Number(resultado.lastInsertRowid),
        seed
    };
});

function iniciar(usuarioId) {
    return iniciarTransaction.immediate(String(usuarioId), Date.now());
}

// ==============================
// FINALIZAR (confere a partida)
// ==============================

const finalizarTransaction = db.transaction(
    (usuarioId, partidaId, pacote, agora) => {
        const partida = db.prepare(`
            SELECT *
            FROM tetris_partidas
            WHERE id = ?
              AND usuario_id = ?
              AND status = 'ativa'
        `).get(Number(partidaId) || 0, usuarioId);

        if (!partida) {
            return { ok: false, motivo: "partida_inexistente" };
        }

        const texto = typeof pacote === "string" ? pacote : "";

        const rejeitar = motivo => {
            db.prepare(`
                UPDATE tetris_partidas
                SET status = 'rejeitada',
                    acoes = ?,
                    finalizada_em = ?
                WHERE id = ?
            `).run(texto.slice(0, MAX_PACOTE), agora, partida.id);

            return { ok: false, motivo };
        };

        if (!texto || texto.length > MAX_PACOTE) {
            return rejeitar("registro_invalido");
        }

        const r = Motor.reproduzir(partida.seed, texto);

        if (!r.ok) {
            return rejeitar("registro_invalido");
        }

        const duracao = agora - partida.iniciada_em;

        if (
            duracao < r.pecas * MIN_MS_POR_PECA ||
            duracao > MAX_DURACAO_MS
        ) {
            return rejeitar("registro_invalido");
        }

        const anterior = db.prepare(`
            SELECT MAX(pontos) AS melhor
            FROM tetris_partidas
            WHERE usuario_id = ?
              AND status = 'finalizada'
        `).get(usuarioId).melhor;

        db.prepare(`
            UPDATE tetris_partidas
            SET status = 'finalizada',
                pontos = ?,
                linhas = ?,
                pecas = ?,
                duracao_ms = ?,
                acoes = ?,
                finalizada_em = ?
            WHERE id = ?
        `).run(
            r.pontos,
            r.linhas,
            r.pecas,
            duracao,
            texto,
            agora,
            partida.id
        );

        return {
            ok: true,
            pontos: r.pontos,
            linhas: r.linhas,
            pecas: r.pecas,
            duracaoMs: duracao,
            novoRecorde: anterior === null || r.pontos > anterior
        };
    }
);

function finalizar(usuarioId, partidaId, pacote) {
    const resposta = finalizarTransaction.immediate(
        String(usuarioId),
        partidaId,
        pacote,
        Date.now()
    );

    if (resposta.ok) {
        resposta.meu = resultadoUsuario(usuarioId);
    }

    return resposta;
}

// ==============================
// RANKING (melhor pontuacao de cada pessoa)
// ==============================

const CONSULTA_RANKING = `
    WITH melhor AS (
        SELECT
            p.id,
            p.usuario_id,
            p.pontos,
            p.linhas,
            p.finalizada_em,
            ROW_NUMBER() OVER (
                PARTITION BY p.usuario_id
                ORDER BY p.pontos DESC, p.finalizada_em ASC, p.id ASC
            ) AS rn
        FROM tetris_partidas p
        WHERE p.status = 'finalizada'
    ),
    ordenado AS (
        SELECT
            m.*,
            ROW_NUMBER() OVER (
                ORDER BY m.pontos DESC, m.finalizada_em ASC, m.id ASC
            ) AS posicao
        FROM melhor m
        WHERE m.rn = 1
    )
`;

function listarRanking(limite = 40) {
    const limiteSeguro = Math.max(
        1,
        Math.min(100, Math.trunc(Number(limite) || 40))
    );

    const linhas = db.prepare(`
        ${CONSULTA_RANKING}
        SELECT
            o.usuario_id,
            COALESCE(u.nome_exibicao, 'Participante') AS nome,
            o.pontos,
            o.linhas,
            o.posicao
        FROM ordenado o
        LEFT JOIN usuarios u
            ON u.usuario_id = o.usuario_id
        ORDER BY o.posicao ASC
        LIMIT ?
    `).all(limiteSeguro);

    const total = db.prepare(`
        SELECT COUNT(DISTINCT usuario_id) AS total
        FROM tetris_partidas
        WHERE status = 'finalizada'
    `).get().total;

    return {
        ranking: linhas.map(l => ({
            usuarioId: String(l.usuario_id),
            nome: l.nome,
            posicao: Number(l.posicao),
            pontos: Number(l.pontos),
            linhas: Number(l.linhas)
        })),
        totalJogadores: Number(total)
    };
}

function resultadoUsuario(usuarioId) {
    const l = db.prepare(`
        ${CONSULTA_RANKING}
        SELECT posicao, pontos, linhas
        FROM ordenado
        WHERE usuario_id = ?
    `).get(String(usuarioId));

    if (!l) return null;

    return {
        posicao: Number(l.posicao),
        pontos: Number(l.pontos),
        linhas: Number(l.linhas)
    };
}

function estado(usuarioId) {
    const partidas = db.prepare(`
        SELECT COUNT(*) AS total
        FROM tetris_partidas
        WHERE usuario_id = ?
          AND status = 'finalizada'
    `).get(String(usuarioId)).total;

    return {
        meu: resultadoUsuario(usuarioId),
        partidasJogadas: Number(partidas)
    };
}

module.exports = {
    iniciar,
    finalizar,
    estado,
    listarRanking,
    resultadoUsuario
};