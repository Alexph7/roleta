const Database = require("better-sqlite3");

const db = new Database("roleta.db");

db.pragma("journal_mode = WAL");

const DURACAO_CHANCE_PREMIADA_MS =
    (
        23 * 60 +
        59
    ) *
    60 *
    1000;

// ========================================
// TABELA
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS giros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id TEXT,

        indice INTEGER NOT NULL,

        premio TEXT NOT NULL,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


// ========================================
// MIGRAÇÃO DO BANCO ANTIGO
// ========================================

const colunas =
    db.prepare(`
        PRAGMA table_info(giros)
    `).all();

const nomesColunas =
    colunas.map(
        coluna => coluna.name
    );

if (!nomesColunas.includes("campanha")) {

    db.exec(`
        ALTER TABLE giros
        ADD COLUMN campanha TEXT
    `);
}

if (!nomesColunas.includes("eh_premio")) {

    db.exec(`
        ALTER TABLE giros
        ADD COLUMN eh_premio INTEGER
        NOT NULL DEFAULT 0
    `);
}


// ========================================
// UM GIRO POR USUÁRIO / CAMPANHA
// ========================================

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_giro_usuario_campanha

    ON giros (
        campanha,
        usuario_id
    )

    WHERE
        campanha IS NOT NULL
        AND usuario_id IS NOT NULL
`);

// ========================================
// ESTADO DA ROLETA
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS estado_roleta (
        id INTEGER PRIMARY KEY
            CHECK (id = 1),

        versao INTEGER
            NOT NULL DEFAULT 1,

        aberta INTEGER
            NOT NULL DEFAULT 0,

        atualizada_em DATETIME
            DEFAULT CURRENT_TIMESTAMP
    )
`);

db.prepare(`
    INSERT OR IGNORE INTO estado_roleta (
        id,
        versao,
        aberta
    )
    VALUES (1, 1, 0)
`).run();

// ========================================
// USUÁRIOS DA MINI APP
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        usuario_id TEXT PRIMARY KEY,

        first_name TEXT,

        last_name TEXT,

        username TEXT,

        nome_exibicao TEXT
            NOT NULL,

        pontos INTEGER
            NOT NULL DEFAULT 0,

        giros_premiada INTEGER
            NOT NULL DEFAULT 0,

        giros_pontos_extras INTEGER
            NOT NULL DEFAULT 0,

        ultimo_periodo_diario TEXT,

        atingiu_pontuacao_em INTEGER,

        dados_json TEXT
            NOT NULL DEFAULT '{}',

        criado_em INTEGER
            NOT NULL,

        atualizado_em INTEGER
            NOT NULL
    )
`);

// ========================================
// MIGRAÇÕES DA TABELA USUARIOS
// ========================================

const colunasUsuarios =
    db.prepare(`
        PRAGMA table_info(usuarios)
    `).all();


const nomesColunasUsuarios =
    colunasUsuarios.map(
        coluna => coluna.name
    );


if (
    !nomesColunasUsuarios.includes(
        "giro_premiada_expira_em"
    )
) {

    db.exec(`
        ALTER TABLE usuarios
        ADD COLUMN giro_premiada_expira_em INTEGER
    `);
}

// ========================================
// HISTÓRICO GENÉRICO DO USUÁRIO
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS eventos_usuario (
        id INTEGER
            PRIMARY KEY AUTOINCREMENT,

        usuario_id TEXT
            NOT NULL,

        tipo TEXT
            NOT NULL,

        origem TEXT,

        valor INTEGER,

        dados_json TEXT,

        criado_em INTEGER
            NOT NULL
    )
`);


// ========================================
// ÍNDICES DOS EVENTOS
// ========================================

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_eventos_usuario

    ON eventos_usuario (
        usuario_id,
        criado_em
    )
`);

// ========================================
// CONSULTAS
// ========================================

// ========================================
// NOME DE EXIBIÇÃO
// ========================================

function criarNomeExibicao(
    firstName,
    lastName,
    username,
    usuarioId
) {

    const nomeCompleto = [
        firstName,
        lastName
    ]
        .filter(Boolean)
        .map(
            valor =>
                String(valor).trim()
        )
        .filter(Boolean)
        .join(" ")
        .trim();


    if (nomeCompleto) {

        return nomeCompleto;
    }


    if (username) {

        const usernameLimpo =
            String(username)
                .trim()
                .replace(/^@/, "");

        if (usernameLimpo) {

            return `@${usernameLimpo}`;
        }
    }


    return `Usuário ${usuarioId}`;
}


// ========================================
// CONVERTER LINHA EM OBJETO DE USUÁRIO
// ========================================

function montarObjetoUsuario(
    linha
) {

    if (!linha) {

        return null;
    }


    let dados = {};

    try {

        dados =
            JSON.parse(
                linha.dados_json ||
                "{}"
            );

    } catch {

        dados = {};
    }


    return {

        usuarioId:
            linha.usuario_id,

        firstName:
            linha.first_name,

        lastName:
            linha.last_name,

        username:
            linha.username,

        nome:
            linha.nome_exibicao,

        pontos:
            Number(
                linha.pontos || 0
            ),

        girosPremiada:
            Number(
                linha.giros_premiada || 0
            ),

        giroPremiadaExpiraEm:
            linha.giro_premiada_expira_em
                ? Number(
                    linha.giro_premiada_expira_em
                )
                : null,

        girosPontosExtras:
            Number(
                linha.giros_pontos_extras || 0
            ),

        ultimoPeriodoDiario:
            linha.ultimo_periodo_diario,

        atingiuPontuacaoEm:
            linha.atingiu_pontuacao_em,

        dados,

        criadoEm:
            linha.criado_em,

        atualizadoEm:
            linha.atualizado_em
    };
}


// ========================================
// BUSCAR USUÁRIO
// ========================================

function buscarUsuario(
    usuarioId
) {

    const linha =
        db.prepare(`
            SELECT *
            FROM usuarios
            WHERE usuario_id = ?
            LIMIT 1
        `).get(
            String(usuarioId)
        );


    return montarObjetoUsuario(
        linha
    );
}


// ========================================
// CRIAR / ATUALIZAR USUÁRIO TELEGRAM
// ========================================

function salvarUsuarioTelegram(
    usuarioTelegram
) {

    const usuarioId =
        String(
            usuarioTelegram.id
        );


    const firstName =
        usuarioTelegram.first_name ||
        null;


    const lastName =
        usuarioTelegram.last_name ||
        null;


    const username =
        usuarioTelegram.username ||
        null;


    const nomeExibicao =
        criarNomeExibicao(
            firstName,
            lastName,
            username,
            usuarioId
        );


    const agora =
        Date.now();


    db.prepare(`
        INSERT INTO usuarios (
            usuario_id,
            first_name,
            last_name,
            username,
            nome_exibicao,
            criado_em,
            atualizado_em
        )

        VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )

        ON CONFLICT(usuario_id)

        DO UPDATE SET

            first_name =
                excluded.first_name,

            last_name =
                excluded.last_name,

            username =
                excluded.username,

            nome_exibicao =
                excluded.nome_exibicao,

            atualizado_em =
                excluded.atualizado_em
    `).run(
        usuarioId,
        firstName,
        lastName,
        username,
        nomeExibicao,
        agora,
        agora
    );


    // ========================================
    // REMOVE CHANCE PREMIADA EXPIRADA
    // ========================================

    db.prepare(`
    UPDATE usuarios

    SET
        giros_premiada = 0,

        giro_premiada_expira_em =
            NULL,

        atualizado_em =
            ?

    WHERE
        usuario_id = ?

        AND giros_premiada > 0

        AND (
            giro_premiada_expira_em
                IS NULL

            OR

            giro_premiada_expira_em
                <= ?
        )
`).run(
        agora,
        usuarioId,
        agora
    );


    return buscarUsuario(
        usuarioId
    );
}

function buscarGiroUsuarioCampanha(
    usuarioId,
    campanha
) {

    return db.prepare(`
        SELECT *

        FROM giros

        WHERE
            usuario_id = ?
            AND campanha = ?

        LIMIT 1
    `).get(
        usuarioId,
        campanha
    );
}


// ========================================
// REGISTRAR EVENTO DO USUÁRIO
// ========================================

function registrarEventoUsuario({
    usuarioId,
    tipo,
    origem = null,
    valor = null,
    dados = null,
    criadoEm = Date.now()
}) {

    const dadosJson =
        dados === null
            ? null
            : JSON.stringify(
                dados
            );


    const resultado =
        db.prepare(`
            INSERT INTO eventos_usuario (
                usuario_id,
                tipo,
                origem,
                valor,
                dados_json,
                criado_em
            )

            VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
            )
        `).run(
            String(usuarioId),
            tipo,
            origem,
            valor,
            dadosJson,
            criadoEm
        );


    return {
        id:
            resultado.lastInsertRowid,

        usuarioId:
            String(usuarioId),

        tipo,

        origem,

        valor,

        dados,

        criadoEm
    };
}

// ========================================
// GIRO DIÁRIO DA ROLETA DE PONTOS
// ========================================

const registrarGiroPontosDiarioTransaction =
    db.transaction(
        ({
            usuarioId,
            periodoDiario,
            indice,
            tipoResultado,
            pontosGanhos = 0,
            girosPremiadaGanhos = 0,
            criadoEm = Date.now()
        }) => {

            const id =
                String(usuarioId);


            const pontos =
                Math.max(
                    0,
                    Math.trunc(
                        Number(
                            pontosGanhos
                        ) || 0
                    )
                );


            const girosPremiada =
                Math.max(
                    0,
                    Math.trunc(
                        Number(
                            girosPremiadaGanhos
                        ) || 0
                    )
                );

            const giroPremiadaExpiraEm =
                girosPremiada > 0
                    ? criadoEm +
                    DURACAO_CHANCE_PREMIADA_MS
                    : null;

            // ========================================
            // USUÁRIO PRECISA EXISTIR
            // ========================================

            const usuarioAntes =
                buscarUsuario(
                    id
                );


            if (!usuarioAntes) {

                return {
                    ok: false,
                    motivo:
                        "usuario_nao_encontrado"
                };
            }


            // ========================================
            // CONSOME O GIRO DIÁRIO
            // E ENTREGA A RECOMPENSA
            //
            // O WHERE É O QUE IMPEDE
            // DOIS GIROS NO MESMO PERÍODO.
            // ========================================

            const atualizacao =
                db.prepare(`
                    UPDATE usuarios

                    SET
                        ultimo_periodo_diario =
                            ?,

                        pontos =
                            pontos + ?,

                        giros_premiada =
                            CASE

                                WHEN ? > 0
                                THEN 1

                                ELSE
                                    giros_premiada

                            END,

                        giro_premiada_expira_em =
                            CASE

                                WHEN ? > 0
                                THEN ?

                                ELSE
                                    giro_premiada_expira_em

                            END,

                        atingiu_pontuacao_em =
                            CASE

                                WHEN ? > 0
                                THEN ?

                                ELSE
                                    atingiu_pontuacao_em

                            END,

                        atualizado_em =
                            ?

                    WHERE
                        usuario_id = ?

                        AND (
                            ultimo_periodo_diario
                                IS NULL

                            OR

                            ultimo_periodo_diario
                                <> ?
                        )
                `).run(
                    periodoDiario,
                    pontos,

                    girosPremiada,

                    girosPremiada,
                    giroPremiadaExpiraEm,

                    pontos,
                    criadoEm,

                    criadoEm,

                    id,
                    periodoDiario
                );


            // ========================================
            // JÁ UTILIZOU O GIRO DAS 08:30
            // ========================================

            if (
                atualizacao.changes !== 1
            ) {

                return {
                    ok: false,

                    motivo:
                        "giro_diario_ja_usado",

                    usuario:
                        buscarUsuario(
                            id
                        )
                };
            }


            // ========================================
            // HISTÓRICO GENÉRICO
            // ========================================

            registrarEventoUsuario({
                usuarioId:
                    id,

                tipo:
                    "GIRO_ROLETA_PONTOS",

                origem:
                    "roleta_pontos",

                valor:
                    pontos > 0
                        ? pontos
                        : girosPremiada,

                dados: {
                    periodoDiario,
                    indice,
                    tipoResultado,

                    pontosGanhos:
                        pontos,

                    girosPremiadaGanhos:
                        girosPremiada,

                    giroPremiadaExpiraEm
                },

                criadoEm
            });


            // ========================================
            // ESTADO FINAL DO USUÁRIO
            // ========================================

            const usuarioDepois =
                buscarUsuario(
                    id
                );


            return {
                ok: true,

                periodoDiario,

                indice,

                tipoResultado,

                pontosGanhos:
                    pontos,

                girosPremiadaGanhos:
                    girosPremiada,

                usuario:
                    usuarioDepois
            };
        }
    );


function registrarGiroPontosDiario(
    dados
) {

    return registrarGiroPontosDiarioTransaction.immediate(
        dados
    );
}

// ========================================
// CONSUMIR CHANCE PESSOAL
// DA ROLETA PREMIADA
// ========================================

const registrarGiroPremiadaBonusTransaction =
    db.transaction(
        ({
            usuarioId,
            indice,
            premio,
            ehPremio,
            criadoEm = Date.now()
        }) => {

            const id =
                String(
                    usuarioId
                );


            // ========================================
            // CONSOME SOMENTE SE:
            //
            // - existe chance
            // - ainda não expirou
            // ========================================

            const consumo =
                db.prepare(`
                    UPDATE usuarios

                    SET
                        giros_premiada = 0,

                        giro_premiada_expira_em =
                            NULL,

                        atualizado_em =
                            ?

                    WHERE
                        usuario_id = ?

                        AND giros_premiada >= 1

                        AND giro_premiada_expira_em
                            IS NOT NULL

                        AND giro_premiada_expira_em
                            > ?
                `).run(
                    criadoEm,
                    id,
                    criadoEm
                );


            if (
                consumo.changes !== 1
            ) {

                return {
                    ok: false,
                    motivo:
                        "chance_bonus_indisponivel",

                    usuario:
                        buscarUsuario(
                            id
                        )
                };
            }


            // ========================================
            // GUARDA O GIRO BÔNUS
            //
            // NÃO VAI PARA A TABELA "giros".
            // portanto NÃO interfere na rodada normal.
            // ========================================

            const evento =
                registrarEventoUsuario({
                    usuarioId:
                        id,

                    tipo:
                        "GIRO_ROLETA_PREMIADA_BONUS",

                    origem:
                        "roleta_pontos",

                    dados: {
                        indice,
                        premio,

                        ehPremio:
                            ehPremio === true
                    },

                    criadoEm
                });


            return {
                ok: true,

                eventoId:
                    evento.id,

                usuario:
                    buscarUsuario(
                        id
                    )
            };
        }
    );


function registrarGiroPremiadaBonus(
    dados
) {

    return registrarGiroPremiadaBonusTransaction.immediate(
        dados
    );
}

// ========================================
// RANKING DA ROLETA DE PONTOS
// ========================================

function listarRankingPontos(
    limite = 20
) {

    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                100,
                Math.trunc(
                    Number(limite) || 20
                )
            )
        );


    return db.prepare(`
        WITH ranking AS (

            SELECT
                u.usuario_id,
                u.nome_exibicao,
                u.username,
                u.pontos,
                u.atingiu_pontuacao_em,
                u.criado_em,

                ROW_NUMBER() OVER (

                    ORDER BY
                        u.pontos DESC,

                        CASE
                            WHEN
                                u.atingiu_pontuacao_em
                                IS NULL
                            THEN 1
                            ELSE 0
                        END ASC,

                        u.atingiu_pontuacao_em
                            ASC,

                        u.criado_em
                            ASC,

                        u.usuario_id
                            ASC

                ) AS posicao

            FROM usuarios u

            WHERE EXISTS (

                SELECT 1

                FROM eventos_usuario e

                WHERE
                    e.usuario_id =
                        u.usuario_id

                    AND e.tipo =
                        'GIRO_ROLETA_PONTOS'
            )
        )

        SELECT
            usuario_id,
            nome_exibicao,
            username,
            pontos,
            posicao

        FROM ranking

        ORDER BY posicao ASC

        LIMIT ?
    `).all(
        limiteSeguro
    );
}

function obterPosicaoRankingPontos(
    usuarioId
) {

    return db.prepare(`
        WITH ranking AS (

            SELECT
                u.usuario_id,
                u.nome_exibicao,
                u.username,
                u.pontos,

                ROW_NUMBER() OVER (

                    ORDER BY
                        u.pontos DESC,

                        CASE
                            WHEN
                                u.atingiu_pontuacao_em
                                IS NULL
                            THEN 1
                            ELSE 0
                        END ASC,

                        u.atingiu_pontuacao_em
                            ASC,

                        u.criado_em
                            ASC,

                        u.usuario_id
                            ASC

                ) AS posicao

            FROM usuarios u

            WHERE EXISTS (

                SELECT 1

                FROM eventos_usuario e

                WHERE
                    e.usuario_id =
                        u.usuario_id

                    AND e.tipo =
                        'GIRO_ROLETA_PONTOS'
            )
        )

        SELECT
            usuario_id,
            nome_exibicao,
            username,
            pontos,
            posicao

        FROM ranking

        WHERE usuario_id = ?

        LIMIT 1
    `).get(
        String(usuarioId)
    ) || null;
}

function contarGanhadoresCampanha(
    campanha
) {

    const resultado =
        db.prepare(`
            SELECT COUNT(*) AS total

            FROM giros

            WHERE
                campanha = ?
                AND eh_premio = 1
        `).get(campanha);

    return resultado.total;
}


// ========================================
// REGISTRAR GIRO
// ========================================

const registrarGiroTransaction =
    db.transaction(
        ({
            usuarioId,
            indice,
            premio,
            campanha,
            ehPremio,
            maxGanhadores
        }) => {

            const giroExistente =
                buscarGiroUsuarioCampanha(
                    usuarioId,
                    campanha
                );

            if (giroExistente) {

                return {
                    ok: false,
                    motivo: "ja_girou",
                    giro: giroExistente
                };
            }

            const totalGanhadores =
                contarGanhadoresCampanha(
                    campanha
                );

            if (
                totalGanhadores >=
                maxGanhadores
            ) {

                return {
                    ok: false,
                    motivo: "esgotado",
                    totalGanhadores
                };
            }

            const resultado =
                db.prepare(`
                    INSERT INTO giros (
                        usuario_id,
                        indice,
                        premio,
                        campanha,
                        eh_premio
                    )

                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    usuarioId,
                    indice,
                    premio,
                    campanha,
                    ehPremio ? 1 : 0
                );

            return {
                ok: true,

                giroId:
                    resultado.lastInsertRowid,

                totalGanhadores:
                    totalGanhadores +
                    (ehPremio ? 1 : 0)
            };
        }
    );


function registrarGiroCampanha(dados) {

    return registrarGiroTransaction.immediate(
        dados
    );
}

function obterEstadoRoleta() {

    const estado =
        db.prepare(`
            SELECT
                versao,
                aberta
            FROM estado_roleta
            WHERE id = 1
        `).get();

    return {
        versao:
            Number(estado.versao),

        aberta:
            estado.aberta === 1
    };
}


function abrirRoleta() {

    db.prepare(`
        UPDATE estado_roleta
        SET
            aberta = 1,
            atualizada_em =
                CURRENT_TIMESTAMP
        WHERE id = 1
    `).run();

    return obterEstadoRoleta();
}

function listarGiros() {

    return db.prepare(`
        SELECT *

        FROM giros

        ORDER BY id DESC

        LIMIT 20
    `).all();
}

function zerarRoleta() {

    const transaction =
        db.transaction(() => {

            const antes =
                db.prepare(`
                    SELECT
                        COUNT(*) AS totalGiros,

                        COALESCE(
                            SUM(eh_premio),
                            0
                        ) AS totalGanhadores
                    FROM giros
                `).get();

            db.prepare(`
                DELETE FROM giros
            `).run();

            db.prepare(`
                DELETE FROM sqlite_sequence
                WHERE name = 'giros'
            `).run();

            db.prepare(`
                UPDATE estado_roleta
                SET
                    versao = versao + 1,
                    aberta = 0,
                    atualizada_em =
                        CURRENT_TIMESTAMP
                WHERE id = 1
            `).run();

            const estadoNovo =
                obterEstadoRoleta();

            return {
                girosRemovidos:
                    Number(
                        antes.totalGiros || 0
                    ),

                ganhadoresRemovidos:
                    Number(
                        antes.totalGanhadores || 0
                    ),

                versao:
                    estadoNovo.versao,

                aberta: false
            };
        });

    return transaction.immediate();
}

module.exports = {
    buscarGiroUsuarioCampanha,
    contarGanhadoresCampanha,
    registrarGiroCampanha,
    listarGiros,
    zerarRoleta,
    obterEstadoRoleta,
    abrirRoleta,

    buscarUsuario,
    salvarUsuarioTelegram,
    registrarEventoUsuario,
    registrarGiroPontosDiario,
    registrarGiroPremiadaBonus,
    listarRankingPontos,
    obterPosicaoRankingPontos
};