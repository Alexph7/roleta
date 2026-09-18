const Database = require("better-sqlite3");

const db = new Database("roleta.db");

db.pragma("journal_mode = WAL");

db.pragma(
    "busy_timeout = 5000"
);

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

        giro_pontos_extra_periodo TEXT,

        ultimo_periodo_diario TEXT,

        bau_ultimo_periodo TEXT,

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

if (
    !nomesColunasUsuarios.includes(
        "bau_ultimo_periodo"
    )
) {

    db.exec(`
        ALTER TABLE usuarios
        ADD COLUMN bau_ultimo_periodo TEXT
    `);
}

if (
    !nomesColunasUsuarios.includes(
        "giro_pontos_extra_periodo"
    )
) {

    db.exec(`
        ALTER TABLE usuarios
        ADD COLUMN giro_pontos_extra_periodo TEXT
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
// ESTOQUE DA ROLETA PREMIADA BÔNUS
// ========================================

const ESTOQUE_INICIAL_PREMIADA_BONUS = {
    "R$ 50": 1,
    "R$ 12": 2,
    "R$ 10": 2,
    "R$ 5": 15,
    "R$ 7": 4
};


const FATIAS_PREMIADA_BASE = [
    {
        tipo: "dinheiro",
        premio: "R$ 50",
        estoqueInicial: 1
    },
    {
        tipo: "diamante",
        premio: "💎",
        pontos: 1000
    },
    {
        tipo: "sem_premio",
        premio: "QUASE"
    },
    {
        tipo: "dinheiro",
        premio: "R$ 5",
        estoqueInicial: 15
    },
    {
        tipo: "diamante",
        premio: "💎",
        pontos: 1000
    },
    {
        tipo: "dinheiro",
        premio: "R$ 5",
        estoqueInicial: 15
    },
    {
        tipo: "dinheiro",
        premio: "R$ 12",
        estoqueInicial: 2
    },
    {
        tipo: "diamante",
        premio: "💎",
        pontos: 1000
    },
    {
        tipo: "dinheiro",
        premio: "R$ 7",
        estoqueInicial: 4
    },
    {
        tipo: "diamante",
        premio: "💎",
        pontos: 1000
    },
    {
        tipo: "dinheiro",
        premio: "R$ 5",
        estoqueInicial: 15
    },
    {
        tipo: "dinheiro",
        premio: "R$ 10",
        estoqueInicial: 2
    },
    {
        tipo: "diamante",
        premio: "💎",
        pontos: 1000
    }
];

db.exec(`
    CREATE TABLE IF NOT EXISTS
    estoque_premiada_bonus (
        premio TEXT PRIMARY KEY,

        quantidade_inicial INTEGER
            NOT NULL,

        quantidade_restante INTEGER
            NOT NULL,

        atualizado_em INTEGER
            NOT NULL
    )
`);


const inserirEstoquePremiadaBonus =
    db.prepare(`
        INSERT OR IGNORE INTO
        estoque_premiada_bonus (
            premio,
            quantidade_inicial,
            quantidade_restante,
            atualizado_em
        )

        VALUES (?, ?, ?, ?)
    `);


const inicializarEstoquePremiadaBonus =
    db.transaction(() => {

        const agora =
            Date.now();


        for (
            const [
                premio,
                quantidade
            ]
            of Object.entries(
                ESTOQUE_INICIAL_PREMIADA_BONUS
            )
        ) {

            inserirEstoquePremiadaBonus.run(
                premio,
                quantidade,
                quantidade,
                agora
            );
        }
    });


inicializarEstoquePremiadaBonus.immediate();

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

        giroPontosExtraPeriodo:
            linha.giro_pontos_extra_periodo,

        ultimoPeriodoDiario:
            linha.ultimo_periodo_diario,

        bauUltimoPeriodo:
            linha.bau_ultimo_periodo,

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
            teveMultiplicador = false,
            multiplicador = null,
            indiceSegundoGiro = null,
            tipoPrimeiroGiro = null,
            tipoSegundoGiro = null,
            pontosBase = 0,
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
                    giroPremiadaExpiraEm,
                    teveMultiplicador:
                        teveMultiplicador === true,
                    multiplicador,
                    indiceSegundoGiro,
                    tipoPrimeiroGiro,
                    tipoSegundoGiro,
                    pontosBase:
                        Number(
                            pontosBase || 0
                        )
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
// GIRO EXTRA DA ROLETA DE PONTOS
// GANHO NO BAÚ
// ========================================

const registrarGiroPontosExtraTransaction =
    db.transaction(
        ({
            usuarioId,
            periodoDiario,
            indice,
            tipoResultado,
            pontosGanhos = 0,
            girosPremiadaGanhos = 0,
            teveMultiplicador = false,
            multiplicador = null,
            indiceSegundoGiro = null,
            tipoPrimeiroGiro = null,
            tipoSegundoGiro = null,
            pontosBase = 0,
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


            const atualizacao =
                db.prepare(`
                    UPDATE usuarios

                    SET
                    giros_pontos_extras =
                        0,

                    giro_pontos_extra_periodo =
                        NULL,

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

                    AND giros_pontos_extras > 0

                    AND giro_pontos_extra_periodo = ?

                `).run(
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


            if (
                atualizacao.changes !== 1
            ) {

                return {
                    ok: false,
                    motivo:
                        "giro_extra_indisponivel",
                    usuario:
                        buscarUsuario(
                            id
                        )
                };
            }


            registrarEventoUsuario({
                usuarioId:
                    id,

                tipo:
                    "GIRO_ROLETA_PONTOS",

                origem:
                    "giro_extra_bau",

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
                    giroPremiadaExpiraEm,
                    teveMultiplicador:
                        teveMultiplicador === true,
                    multiplicador,
                    indiceSegundoGiro,
                    tipoPrimeiroGiro,
                    tipoSegundoGiro,
                    pontosBase:
                        Number(
                            pontosBase || 0
                        ),
                    giroExtra:
                        true
                },

                criadoEm
            });


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
                    buscarUsuario(
                        id
                    )
            };
        }
    );


function registrarGiroPontosExtra(
    dados
) {

    return registrarGiroPontosExtraTransaction.immediate(
        dados
    );
}


// ========================================
// BAÚ DA SEGUNDA CHANCE
// ========================================

const registrarBauSegundaChanceTransaction =
    db.transaction(
        ({
            usuarioId,
            periodoDiario,
            indiceEscolhido,
            indiceBauPontos,
            pontosSorteados,
            criadoEm = Date.now()
        }) => {

            const id =
                String(usuarioId);


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


            if (
                usuarioAntes
                    .ultimoPeriodoDiario !==
                periodoDiario
            ) {

                return {
                    ok: false,
                    motivo:
                        "giro_diario_necessario"
                };
            }


            if (
                usuarioAntes
                    .bauUltimoPeriodo ===
                periodoDiario
            ) {

                return {
                    ok: false,
                    motivo:
                        "bau_ja_usado"
                };
            }


            const escolhido =
                Math.trunc(
                    Number(
                        indiceEscolhido
                    )
                );


            const bauPontos =
                Math.trunc(
                    Number(
                        indiceBauPontos
                    )
                );


            const ganhouPontos =
                escolhido ===
                bauPontos;


            const pontosGanhos =
                ganhouPontos
                    ? Math.max(
                        200,
                        Math.min(
                            400,
                            Math.trunc(
                                Number(
                                    pontosSorteados
                                ) || 200
                            )
                        )
                    )
                    : 0;


            const girosPontosExtrasGanhos =
                ganhouPontos
                    ? 0
                    : 1;


            const atualizacao =
                db.prepare(`
                    UPDATE usuarios

                    SET
                        bau_ultimo_periodo =
                            ?,

                        pontos =
                            pontos + ?,

                        giros_pontos_extras =
                        CASE

                            WHEN ? > 0
                            THEN 1

                            ELSE 0

                        END,

                    giro_pontos_extra_periodo =
                        CASE

                            WHEN ? > 0
                            THEN ?

                            ELSE NULL

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

                        AND ultimo_periodo_diario =
                            ?

                        AND (
                            bau_ultimo_periodo
                                IS NULL

                            OR

                            bau_ultimo_periodo
                                <> ?
                        )
              `).run(
                    periodoDiario,

                    pontosGanhos,

                    girosPontosExtrasGanhos,

                    girosPontosExtrasGanhos,
                    periodoDiario,

                    pontosGanhos,
                    criadoEm,

                    criadoEm,

                    id,

                    periodoDiario,

                    periodoDiario
                );

            if (
                atualizacao.changes !== 1
            ) {

                return {
                    ok: false,
                    motivo:
                        "bau_indisponivel",
                    usuario:
                        buscarUsuario(
                            id
                        )
                };
            }


            registrarEventoUsuario({
                usuarioId:
                    id,

                tipo:
                    "BAU_SEGUNDA_CHANCE",

                origem:
                    "bau_segunda_chance",

                valor:
                    pontosGanhos > 0
                        ? pontosGanhos
                        : girosPontosExtrasGanhos,

                dados: {
                    periodoDiario,
                    indiceEscolhido:
                        escolhido,
                    indiceBauPontos:
                        bauPontos,
                    tipoPremio:
                        ganhouPontos
                            ? "pontos"
                            : "giro_extra",
                    pontosGanhos,
                    girosPontosExtrasGanhos
                },

                criadoEm
            });


            return {
                ok: true,

                periodoDiario,

                indiceEscolhido:
                    escolhido,

                indiceBauPontos:
                    bauPontos,

                tipoPremio:
                    ganhouPontos
                        ? "pontos"
                        : "giro_extra",

                pontosGanhos,

                girosPontosExtrasGanhos,

                usuario:
                    buscarUsuario(
                        id
                    )
            };
        }
    );


function registrarBauSegundaChance(
    dados
) {

    return registrarBauSegundaChanceTransaction.immediate(
        dados
    );
}

// ========================================
// CONFIGURAÇÃO DINÂMICA
// DA ROLETA PREMIADA BÔNUS
// ========================================

function obterConfiguracaoPremiadaBonus() {

    const linhasEstoque =
        db.prepare(`
            SELECT
                premio,
                quantidade_inicial,
                quantidade_restante

            FROM estoque_premiada_bonus
        `).all();


    const estoque =
    {};


    for (
        const linha
        of linhasEstoque
    ) {

        estoque[
            linha.premio
        ] = {
            inicial:
                Number(
                    linha.quantidade_inicial ||
                    0
                ),

            restante:
                Number(
                    linha.quantidade_restante ||
                    0
                )
        };
    }


    const fatias =
        FATIAS_PREMIADA_BASE.map(
            (
                fatia,
                indice
            ) => {

                // ========================================
                // DIAMANTE ORIGINAL
                // ========================================

                if (
                    fatia.tipo ===
                    "diamante"
                ) {

                    return {
                        indice,
                        tipo:
                            "diamante",
                        premio:
                            "💎",
                        pontos:
                            1000,
                        substituiuPremio:
                            null
                    };
                }


                // ========================================
                // FATIA SEM PRÊMIO
                // ========================================

                if (
                    fatia.tipo !==
                    "dinheiro"
                ) {

                    return {
                        indice,
                        tipo:
                            "sem_premio",
                        premio:
                            fatia.premio,
                        pontos:
                            0,
                        substituiuPremio:
                            null
                    };
                }


                const restante =
                    Number(
                        estoque[
                            fatia.premio
                        ]?.restante ||
                        0
                    );


                // ========================================
                // ESTOQUE ACABOU
                // VIRA DIAMANTE
                // ========================================

                if (
                    restante <= 0
                ) {

                    return {
                        indice,
                        tipo:
                            "diamante",
                        premio:
                            "💎",
                        pontos:
                            1000,

                        substituiuPremio:
                            fatia.premio
                    };
                }


                // ========================================
                // AINDA TEM DINHEIRO
                // ========================================

                return {
                    indice,
                    tipo:
                        "dinheiro",
                    premio:
                        fatia.premio,
                    pontos:
                        0,
                    substituiuPremio:
                        null
                };
            }
        );


    return {

        fatias,

        itens:
            fatias.map(
                fatia =>
                    fatia.premio
            ),

        estoque
    };
}


// ========================================
// RESET MANUAL DO ESTOQUE BÔNUS
// ========================================

function resetarEstoquePremiadaBonus() {

    const transaction =
        db.transaction(() => {

            const agora =
                Date.now();


            const salvar =
                db.prepare(`
                    INSERT INTO
                    estoque_premiada_bonus (
                        premio,
                        quantidade_inicial,
                        quantidade_restante,
                        atualizado_em
                    )

                    VALUES (?, ?, ?, ?)

                    ON CONFLICT(premio)

                    DO UPDATE SET
                        quantidade_inicial =
                            excluded.quantidade_inicial,

                        quantidade_restante =
                            excluded.quantidade_restante,

                        atualizado_em =
                            excluded.atualizado_em
                `);


            for (
                const [
                    premio,
                    quantidade
                ]
                of Object.entries(
                    ESTOQUE_INICIAL_PREMIADA_BONUS
                )
            ) {

                salvar.run(
                    premio,
                    quantidade,
                    quantidade,
                    agora
                );
            }


            return obterConfiguracaoPremiadaBonus();
        });


    return transaction.immediate();
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
            criadoEm = Date.now()
        }) => {

            const id =
                String(
                    usuarioId
                );


            const indiceSeguro =
                Math.trunc(
                    Number(
                        indice
                    )
                );


            const configuracaoAntes =
                obterConfiguracaoPremiadaBonus();


            if (
                !Number.isInteger(
                    indiceSeguro
                ) ||
                indiceSeguro < 0 ||
                indiceSeguro >=
                configuracaoAntes
                    .fatias
                    .length
            ) {

                return {
                    ok: false,
                    motivo:
                        "indice_invalido"
                };
            }


            const fatia =
                configuracaoAntes
                    .fatias[
                indiceSeguro
                ];


            const premio =
                fatia.premio;


            const tipoResultado =
                fatia.tipo;


            const pontosGanhos =
                tipoResultado ===
                    "diamante"
                    ? 1000
                    : 0;


            const ehPremio =
                tipoResultado ===
                "dinheiro";


            // ========================================
            // CONSOME A CHANCE
            //
            // SE FOR DIAMANTE,
            // JÁ ENTREGA OS 1000 PONTOS.
            // ========================================

            const consumo =
                db.prepare(`
                    UPDATE usuarios

                    SET
                        giros_premiada = 0,

                        giro_premiada_expira_em =
                            NULL,

                        pontos =
                            pontos + ?,

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

                        AND giros_premiada >= 1

                        AND giro_premiada_expira_em
                            IS NOT NULL

                        AND giro_premiada_expira_em
                            > ?
                `).run(
                    pontosGanhos,

                    pontosGanhos,
                    criadoEm,

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
            // SE CAIU EM DINHEIRO,
            // BAIXA UMA UNIDADE DO ESTOQUE.
            //
            // COMO A TRANSAÇÃO É IMMEDIATE,
            // DUAS PESSOAS NÃO LEVAM
            // A ÚLTIMA UNIDADE.
            // ========================================

            if (ehPremio) {

                const baixa =
                    db.prepare(`
                        UPDATE
                            estoque_premiada_bonus

                        SET
                            quantidade_restante =
                                quantidade_restante - 1,

                            atualizado_em =
                                ?

                        WHERE
                            premio = ?

                            AND quantidade_restante
                                > 0
                    `).run(
                        criadoEm,
                        premio
                    );


                if (
                    baixa.changes !== 1
                ) {

                    throw new Error(
                        `Estoque inconsistente para ${premio}`
                    );
                }
            }


            // ========================================
            // REGISTRA O RESULTADO
            // ========================================

            const evento =
                registrarEventoUsuario({
                    usuarioId:
                        id,

                    tipo:
                        "GIRO_ROLETA_PREMIADA_BONUS",

                    origem:
                        "roleta_pontos",

                    valor:
                        pontosGanhos > 0
                            ? pontosGanhos
                            : null,

                    dados: {
                        indice:
                            indiceSeguro,

                        premio,

                        ehPremio,

                        tipoResultado,

                        pontosGanhos,

                        substituiuPremio:
                            fatia
                                .substituiuPremio ||
                            null
                    },

                    criadoEm
                });


            // ========================================
            // CONFIGURAÇÃO PARA O PRÓXIMO GIRO
            // ========================================

            const configuracaoDepois =
                obterConfiguracaoPremiadaBonus();


            return {
                ok: true,

                eventoId:
                    evento.id,

                indice:
                    indiceSeguro,

                premio,

                ehPremio,

                tipoResultado,

                pontosGanhos,

                substituiuPremio:
                    fatia
                        .substituiuPremio ||
                    null,

                itensGiro:
                    configuracaoAntes.itens,

                itensDepois:
                    configuracaoDepois.itens,

                estoque:
                    configuracaoDepois.estoque,

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

           WHERE
                u.pontos > 0

                OR EXISTS (

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

            WHERE
            u.pontos > 0

            OR EXISTS (
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


// ========================================
// HISTÓRICO PÚBLICO
// ROLETA PREMIADA
// ========================================

function listarGanhadoresPremiada() {

    // ========================================
    // GIROS DA DINÂMICA NORMAL
    // ========================================

    const normais =
        db.prepare(`
            SELECT
                g.usuario_id,

                COALESCE(
                    u.nome_exibicao,
                    'Participante'
                ) AS nome,

                g.premio,

                CAST(
                    strftime(
                        '%s',
                        g.criado_em
                    )
                    AS INTEGER
                ) * 1000 AS criado_em

            FROM giros g

            LEFT JOIN usuarios u
                ON u.usuario_id =
                    g.usuario_id

            WHERE
                g.eh_premio = 1

            ORDER BY
                g.id ASC
        `).all();


    // ========================================
    // GIROS GANHOS PELA ROLETA DE PONTOS
    // ========================================

    const bonusBrutos =
        db.prepare(`
            SELECT
                e.usuario_id,

                COALESCE(
                    u.nome_exibicao,
                    'Participante'
                ) AS nome,

                e.dados_json,

                e.criado_em

            FROM eventos_usuario e

            LEFT JOIN usuarios u
                ON u.usuario_id =
                    e.usuario_id

            WHERE
                e.tipo =
                    'GIRO_ROLETA_PREMIADA_BONUS'

            ORDER BY
                e.criado_em ASC
        `).all();


    const bonus = [];


    for (
        const evento
        of bonusBrutos
    ) {

        let dados = {};

        try {

            dados =
                JSON.parse(
                    evento.dados_json ||
                    "{}"
                );

        } catch {

            dados = {};
        }


        const premio =
            String(
                dados.premio || ""
            );


        if (
            !premio.startsWith(
                "R$"
            )
        ) {

            continue;
        }


        bonus.push({

            usuario_id:
                evento.usuario_id,

            nome:
                evento.nome,

            premio,

            criado_em:
                Number(
                    evento.criado_em || 0
                )
        });
    }


    // ========================================
    // JUNTA AS DUAS DINÂMICAS
    // ========================================

    return [
        ...normais,
        ...bonus
    ]
        .filter(
            item =>
                String(
                    item.premio || ""
                ).startsWith(
                    "R$"
                )
        )
        .sort(
            (a, b) =>
                Number(
                    a.criado_em || 0
                ) -
                Number(
                    b.criado_em || 0
                )
        )
        .map(
            item => ({
                usuarioId:
                    item.usuario_id,

                nome:
                    item.nome,

                premio:
                    item.premio,

                criadoEm:
                    Number(
                        item.criado_em || 0
                    )
            })
        );
}

// ========================================
// ÚLTIMOS RESULTADOS
// ROLETA DE PONTOS
// ========================================

function listarUltimosResultadosPontos(
    limite = 20
) {

    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                20,
                Math.trunc(
                    Number(limite) || 7
                )
            )
        );


    const eventos =
        db.prepare(`
            SELECT
                e.usuario_id,

                COALESCE(
                    u.nome_exibicao,
                    'Participante'
                ) AS nome,

                e.dados_json,

                e.criado_em

            FROM eventos_usuario e

            LEFT JOIN usuarios u
                ON u.usuario_id =
                    e.usuario_id

            WHERE
                e.tipo =
                    'GIRO_ROLETA_PONTOS'

            ORDER BY
                e.criado_em DESC,
                e.id DESC

            LIMIT ?
        `).all(
            limiteSeguro
        );


    const resultados = [];


    for (
        const evento
        of eventos
    ) {

        let dados = {};

        try {

            dados =
                JSON.parse(
                    evento.dados_json ||
                    "{}"
                );

        } catch {

            dados = {};
        }


        resultados.push({

            usuarioId:
                evento.usuario_id,

            nome:
                evento.nome,

            tipo:
                dados.tipoResultado ||
                "pontos",

            pontos:
                Number(
                    dados.pontosGanhos ||
                    0
                ),

            girosPremiada:
                Number(
                    dados.girosPremiadaGanhos ||
                    0
                ),

            teveMultiplicador:
                dados.teveMultiplicador ===
                true,

            multiplicador:
                dados.multiplicador
                    ? Number(
                        dados.multiplicador
                    )
                    : null,

            pontosBase:
                Number(
                    dados.pontosBase ||
                    0
                ),

            criadoEm:
                Number(
                    evento.criado_em || 0
                )
        });
    }

    // SQL já buscou do mais novo para o mais velho.
    return resultados;
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
            maxGanhadores,
            tipoResultado = null,
            pontosGanhos = 0,
            criadoEm = Date.now()
        }) => {

            const id =
                String(
                    usuarioId
                );


            const pontos =
                Math.max(
                    0,
                    Math.trunc(
                        Number(
                            pontosGanhos
                        ) || 0
                    )
                );


            const giroExistente =
                buscarGiroUsuarioCampanha(
                    id,
                    campanha
                );


            if (giroExistente) {

                return {
                    ok: false,
                    motivo:
                        "ja_girou",
                    giro:
                        giroExistente
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
                    motivo:
                        "esgotado",
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
                    id,
                    indice,
                    premio,
                    campanha,
                    ehPremio ? 1 : 0
                );


            // ========================================
            // DIAMANTE DA RODADA MANUAL
            // TAMBÉM VALE 1000 PONTOS
            // ========================================

            if (
                pontos > 0
            ) {

                const atualizacao =
                    db.prepare(`
                        UPDATE usuarios

                        SET
                            pontos =
                                pontos + ?,

                            atingiu_pontuacao_em =
                                ?,

                            atualizado_em =
                                ?

                        WHERE
                            usuario_id = ?
                    `).run(
                        pontos,
                        criadoEm,
                        criadoEm,
                        id
                    );


                if (
                    atualizacao.changes !==
                    1
                ) {

                    throw new Error(
                        "Usuário não encontrado ao creditar diamante"
                    );
                }
            }


            registrarEventoUsuario({
                usuarioId:
                    id,

                tipo:
                    "GIRO_ROLETA_PREMIADA_NORMAL",

                origem:
                    "rodada_manual",

                valor:
                    pontos > 0
                        ? pontos
                        : null,

                dados: {
                    indice,
                    premio,

                    ehPremio:
                        ehPremio === true,

                    tipoResultado,

                    pontosGanhos:
                        pontos
                },

                criadoEm
            });


            return {
                ok: true,

                giroId:
                    resultado.lastInsertRowid,

                totalGanhadores:
                    totalGanhadores +
                    (
                        ehPremio
                            ? 1
                            : 0
                    ),

                usuario:
                    buscarUsuario(
                        id
                    )
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
    registrarGiroPontosExtra,
    registrarBauSegundaChance,
    registrarGiroPremiadaBonus,
    listarRankingPontos,
    obterPosicaoRankingPontos,

    listarGanhadoresPremiada,
    listarUltimosResultadosPontos,

    obterConfiguracaoPremiadaBonus,
    resetarEstoquePremiadaBonus
};