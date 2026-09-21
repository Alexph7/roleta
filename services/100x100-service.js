const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const db = new Database(
    path.join(
        __dirname,
        "..",
        "roleta.db"
    )
);

db.pragma(
    "busy_timeout = 5000"
);

const PREMIOS = [
    100,
    200,
    300,
    500,
    700,
    1000
];

const CUSTOS = [
    0,
    100,
    200
];

const MAX_PARTIDAS =
    CUSTOS.length;


// ========================================
// BANCO DO 100x100
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS
    jogo_100x100_partidas (

        id INTEGER
            PRIMARY KEY AUTOINCREMENT,

        usuario_id TEXT
            NOT NULL,

        periodo TEXT
            NOT NULL,

        numero_partida INTEGER
            NOT NULL,

        custo INTEGER
            NOT NULL DEFAULT 0,

        status TEXT
            NOT NULL,

        linha_atual INTEGER
            NOT NULL DEFAULT 0,

        premio_provisorio INTEGER
            NOT NULL DEFAULT 0,

        mapa_json TEXT
            NOT NULL,

        historico_json TEXT
            NOT NULL DEFAULT '[]',

        criado_em INTEGER
            NOT NULL,

        atualizado_em INTEGER
            NOT NULL,

        encerrado_em INTEGER
    );


    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_100x100_usuario_periodo_numero

    ON jogo_100x100_partidas (
        usuario_id,
        periodo,
        numero_partida
    );


    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_100x100_partida_ativa

    ON jogo_100x100_partidas (
        usuario_id
    )

    WHERE status = 'ativa';
`);


// ========================================
// AUXILIARES
// ========================================

function json(
    valor,
    padrao
) {

    try {

        return JSON.parse(
            valor ||
            JSON.stringify(
                padrao
            )
        );

    } catch {

        return padrao;
    }
}


function obterPeriodoDiario(
    data = new Date()
) {

    const partes =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "America/Sao_Paulo",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23"
            }
        ).formatToParts(
            data
        );


    const valores = {};


    for (
        const parte
        of partes
    ) {

        if (
            parte.type !==
            "literal"
        ) {

            valores[
                parte.type
            ] =
                parte.value;
        }
    }


    let ano =
        Number(
            valores.year
        );

    let mes =
        Number(
            valores.month
        );

    let dia =
        Number(
            valores.day
        );


    const hora =
        Number(
            valores.hour
        );

    const minuto =
        Number(
            valores.minute
        );


    const antes0830 =
        hora < 8 ||
        (
            hora === 8 &&
            minuto < 30
        );


    if (
        antes0830
    ) {

        const anterior =
            new Date(
                Date.UTC(
                    ano,
                    mes - 1,
                    dia - 1
                )
            );


        ano =
            anterior
                .getUTCFullYear();

        mes =
            anterior
                .getUTCMonth() +
            1;

        dia =
            anterior
                .getUTCDate();
    }


    return (
        `${ano}-` +
        `${String(
            mes
        ).padStart(
            2,
            "0"
        )}-` +
        `${String(
            dia
        ).padStart(
            2,
            "0"
        )}`
    );
}


function buscarUsuario(
    usuarioId
) {

    return db.prepare(`
        SELECT
            usuario_id,
            nome_exibicao,
            pontos,
            atingiu_pontuacao_em

        FROM usuarios

        WHERE
            usuario_id = ?

        LIMIT 1
    `).get(
        String(
            usuarioId
        )
    ) || null;
}


function registrarEvento(
    usuarioId,
    tipo,
    valor,
    dados,
    criadoEm
) {

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
            '100x100',
            ?,
            ?,
            ?
        )
    `).run(
        String(
            usuarioId
        ),

        tipo,

        valor ??
        null,

        JSON.stringify(
            dados || {}
        ),

        criadoEm
    );
}


function expirarPartidaAntiga(
    usuarioId,
    periodo,
    agora
) {

    db.prepare(`
        UPDATE jogo_100x100_partidas

        SET
            status =
                'expirada',

            atualizado_em =
                ?,

            encerrado_em =
                ?

        WHERE
            usuario_id = ?

            AND status =
                'ativa'

            AND periodo <> ?
    `).run(
        agora,
        agora,
        String(
            usuarioId
        ),
        periodo
    );
}


function buscarAtiva(
    usuarioId,
    periodo
) {

    return db.prepare(`
        SELECT *

        FROM jogo_100x100_partidas

        WHERE
            usuario_id = ?

            AND periodo = ?

            AND status =
                'ativa'

        ORDER BY id DESC

        LIMIT 1
    `).get(
        String(
            usuarioId
        ),
        periodo
    ) || null;
}


function buscarUltima(
    usuarioId,
    periodo
) {

    return db.prepare(`
        SELECT *

        FROM jogo_100x100_partidas

        WHERE
            usuario_id = ?

            AND periodo = ?

        ORDER BY id DESC

        LIMIT 1
    `).get(
        String(
            usuarioId
        ),
        periodo
    ) || null;
}


function contarPartidas(
    usuarioId,
    periodo
) {

    const linha =
        db.prepare(`
            SELECT
                COUNT(*) AS total

            FROM jogo_100x100_partidas

            WHERE
                usuario_id = ?

                AND periodo = ?
        `).get(
            String(
                usuarioId
            ),
            periodo
        );


    return Number(
        linha?.total ||
        0
    );
}


function partidaPublica(
    partida
) {

    if (
        !partida
    ) {

        return null;
    }


    return {

        id:
            Number(
                partida.id
            ),

        numeroPartida:
            Number(
                partida
                    .numero_partida
            ),

        custo:
            Number(
                partida.custo ||
                0
            ),

        status:
            String(
                partida.status ||
                ""
            ),

        linhaAtual:
            Number(
                partida.linha_atual ||
                0
            ),

        premioProvisorio:
            Number(
                partida
                    .premio_provisorio ||
                0
            ),

        historico:
            json(
                partida
                    .historico_json,
                []
            )
    };
}


function montarEstado(
    usuarioId,
    periodo
) {

    const usuario =
        buscarUsuario(
            usuarioId
        );


    if (
        !usuario
    ) {

        return {
            ok: false,

            motivo:
                "usuario_nao_encontrado"
        };
    }


    const partidaAtiva =
        buscarAtiva(
            usuarioId,
            periodo
        );


    const ultimaPartida =
        buscarUltima(
            usuarioId,
            periodo
        );


    const partidasUsadas =
        contarPartidas(
            usuarioId,
            periodo
        );


    const proximaPartida =
        partidasUsadas <
            MAX_PARTIDAS

            ? partidasUsadas +
            1

            : null;


    return {

        ok:
            true,

        periodo,

        pontos:
            Number(
                usuario.pontos ||
                0
            ),

        partidasUsadas,

        maxPartidas:
            MAX_PARTIDAS,

        proximaPartida,

        proximoCusto:
            proximaPartida

                ? CUSTOS[
                proximaPartida -
                1
                ]

                : null,

        partidaAtiva:
            partidaPublica(
                partidaAtiva
            ),

        ultimaPartida:
            partidaPublica(
                ultimaPartida
            )
    };
}


function criarMapa() {

    return PREMIOS.map(
        () => ({

            ladoPremio:
                crypto.randomInt(
                    0,
                    2
                )
        })
    );
}


// ========================================
// ESTADO
// ========================================

const obterEstadoTx =
    db.transaction(
        usuarioId => {

            const periodo =
                obterPeriodoDiario();


            expirarPartidaAntiga(
                usuarioId,
                periodo,
                Date.now()
            );


            return montarEstado(
                usuarioId,
                periodo
            );
        }
    );


function obterEstado100x100(
    usuarioId
) {

    return obterEstadoTx.immediate(
        String(
            usuarioId
        )
    );
}


// ========================================
// INICIAR PARTIDA
// ========================================

const iniciarTx =
    db.transaction(
        usuarioId => {

            const id =
                String(
                    usuarioId
                );


            const agora =
                Date.now();


            const periodo =
                obterPeriodoDiario();


            expirarPartidaAntiga(
                id,
                periodo,
                agora
            );


            if (
                buscarAtiva(
                    id,
                    periodo
                )
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "partida_ativa",

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            const usuario =
                buscarUsuario(
                    id
                );


            if (
                !usuario
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "usuario_nao_encontrado"
                };
            }


            const usadas =
                contarPartidas(
                    id,
                    periodo
                );


            if (
                usadas >=
                MAX_PARTIDAS
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "limite_diario",

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            const numeroPartida =
                usadas + 1;


            const custo =
                CUSTOS[
                numeroPartida -
                1
                ];


            const saldoAntes =
                Number(
                    usuario.pontos ||
                    0
                );


            // ========================================
            // SEGUNDA / TERCEIRA PARTIDA
            // DEBITA SOMENTE SE HOUVER SALDO
            // ========================================

            if (
                custo > 0
            ) {

                const debito =
                    db.prepare(`
                        UPDATE usuarios

                        SET
                            pontos =
                                pontos - ?,

                            atingiu_pontuacao_em =
                                ?,

                            atualizado_em =
                                ?

                        WHERE
                            usuario_id = ?

                            AND pontos >= ?
                    `).run(
                        custo,
                        agora,
                        agora,
                        id,
                        custo
                    );


                if (
                    debito.changes !==
                    1
                ) {

                    return {

                        ok:
                            false,

                        motivo:
                            "saldo_insuficiente",

                        custo,

                        estado:
                            montarEstado(
                                id,
                                periodo
                            )
                    };
                }


                registrarEvento(
                    id,

                    "JOGO_100X100_COMPRA",

                    -custo,

                    {
                        periodo,

                        numeroPartida,

                        pontosGastos:
                            custo,

                        deltaPontos:
                            -custo,

                        saldoAntes,

                        saldoDepois:
                            saldoAntes -
                            custo
                    },

                    agora
                );
            }


            const insercao =
                db.prepare(`
                    INSERT INTO jogo_100x100_partidas (
                        usuario_id,
                        periodo,
                        numero_partida,
                        custo,
                        status,
                        linha_atual,
                        premio_provisorio,
                        mapa_json,
                        historico_json,
                        criado_em,
                        atualizado_em
                    )

                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        'ativa',
                        0,
                        0,
                        ?,
                        '[]',
                        ?,
                        ?
                    )
                `).run(
                    id,
                    periodo,
                    numeroPartida,
                    custo,

                    JSON.stringify(
                        criarMapa()
                    ),

                    agora,
                    agora
                );


            registrarEvento(
                id,

                "JOGO_100X100_INICIO",

                null,

                {
                    periodo,

                    numeroPartida,

                    custo,

                    partidaId:
                        Number(
                            insercao
                                .lastInsertRowid
                        )
                },

                agora
            );


            return {

                ok:
                    true,

                estado:
                    montarEstado(
                        id,
                        periodo
                    )
            };
        }
    );


function iniciarPartida100x100(
    usuarioId
) {

    return iniciarTx.immediate(
        String(
            usuarioId
        )
    );
}


// ========================================
// ESCOLHER UM DOS DOIS QUADRADOS
// ========================================

const escolherTx =
    db.transaction(
        (
            usuarioId,
            ladoEscolhido
        ) => {

            const id =
                String(
                    usuarioId
                );


            const lado =
                Math.trunc(
                    Number(
                        ladoEscolhido
                    )
                );


            if (
                lado !== 0 &&
                lado !== 1
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "lado_invalido"
                };
            }


            const agora =
                Date.now();


            const periodo =
                obterPeriodoDiario();


            expirarPartidaAntiga(
                id,
                periodo,
                agora
            );


            const partida =
                buscarAtiva(
                    id,
                    periodo
                );


            if (
                !partida
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "sem_partida_ativa",

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            const linha =
                Number(
                    partida
                        .linha_atual
                );


            if (
                linha < 0 ||
                linha >=
                PREMIOS.length
            ) {

                throw new Error(
                    "Linha inválida no 100x100"
                );
            }


            const mapa =
                json(
                    partida.mapa_json,
                    []
                );


            const historico =
                json(
                    partida
                        .historico_json,
                    []
                );


            const acertou =
                lado ===
                Number(
                    mapa[
                        linha
                    ]?.ladoPremio
                );


            // ========================================
            // X = PERDE A PARTIDA
            // ========================================

            if (
                !acertou
            ) {

                historico.push({

                    linha,

                    lado,

                    tipo:
                        "x",

                    premio:
                        0
                });


                db.prepare(`
                    UPDATE jogo_100x100_partidas

                    SET
                        status =
                            'perdeu',

                        historico_json =
                            ?,

                        atualizado_em =
                            ?,

                        encerrado_em =
                            ?

                    WHERE
                        id = ?

                        AND status =
                            'ativa'
                `).run(
                    JSON.stringify(
                        historico
                    ),

                    agora,
                    agora,

                    partida.id
                );


                registrarEvento(
                    id,

                    "JOGO_100X100_PERDEU",

                    null,

                    {
                        periodo,

                        numeroPartida:
                            Number(
                                partida
                                    .numero_partida
                            ),

                        linha:
                            linha + 1,

                        premioPerdido:
                            Number(
                                partida
                                    .premio_provisorio ||
                                0
                            )
                    },

                    agora
                );


                return {

                    ok:
                        true,

                    resultado: {

                        linha,

                        lado,

                        tipo:
                            "x",

                        premio:
                            0
                    },

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            // ========================================
            // ÚLTIMA LINHA
            // DIAMANTE + 1.000 PONTOS
            // ========================================

            if (
                linha ===
                PREMIOS.length -
                1
            ) {

                const pontosGanhos =
                    1000;


                const usuarioAntes =
                    buscarUsuario(
                        id
                    );


                const saldoAntes =
                    Number(
                        usuarioAntes
                            ?.pontos ||
                        0
                    );


                const credito =
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
                        pontosGanhos,
                        agora,
                        agora,
                        id
                    );


                if (
                    credito.changes !==
                    1
                ) {

                    throw new Error(
                        "Usuário não encontrado ao creditar diamante do 100x100"
                    );
                }


                historico.push({

                    linha,

                    lado,

                    tipo:
                        "diamante",

                    premio:
                        pontosGanhos
                });


                db.prepare(`
                    UPDATE jogo_100x100_partidas

                    SET
                        status =
                            'diamante',

                        linha_atual =
                            6,

                        premio_provisorio =
                            ?,

                        historico_json =
                            ?,

                        atualizado_em =
                            ?,

                        encerrado_em =
                            ?

                    WHERE
                        id = ?

                        AND status =
                            'ativa'
                `).run(
                    pontosGanhos,

                    JSON.stringify(
                        historico
                    ),

                    agora,
                    agora,

                    partida.id
                );


                registrarEvento(
                    id,

                    "JOGO_100X100_RESGATE",

                    pontosGanhos,

                    {
                        periodo,

                        numeroPartida:
                            Number(
                                partida
                                    .numero_partida
                            ),

                        tipoResultado:
                            "diamante",

                        premio:
                            "💎",

                        pontosGanhos,

                        saldoAntes,

                        saldoDepois:
                            saldoAntes +
                            pontosGanhos,

                        linhaAlcancada:
                            6
                    },

                    agora
                );


                return {

                    ok:
                        true,

                    resultado: {

                        linha,

                        lado,

                        tipo:
                            "diamante",

                        premio:
                            pontosGanhos
                    },

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            // ========================================
            // ACERTOU 100 / 200 / 300 / 500 / 700
            // AINDA NÃO CREDITA.
            // FICA PROVISÓRIO.
            // ========================================

            const premio =
                PREMIOS[
                linha
                ];


            historico.push({

                linha,

                lado,

                tipo:
                    "pontos",

                premio
            });


            db.prepare(`
                UPDATE jogo_100x100_partidas

                SET
                    linha_atual =
                        ?,

                    premio_provisorio =
                        ?,

                    historico_json =
                        ?,

                    atualizado_em =
                        ?

                WHERE
                    id = ?

                    AND status =
                        'ativa'
            `).run(
                linha + 1,

                premio,

                JSON.stringify(
                    historico
                ),

                agora,

                partida.id
            );


            registrarEvento(
                id,

                "JOGO_100X100_AVANCO",

                null,

                {
                    periodo,

                    numeroPartida:
                        Number(
                            partida
                                .numero_partida
                        ),

                    linha:
                        linha + 1,

                    premioProvisorio:
                        premio
                },

                agora
            );


            return {

                ok:
                    true,

                resultado: {

                    linha,

                    lado,

                    tipo:
                        "pontos",

                    premio
                },

                estado:
                    montarEstado(
                        id,
                        periodo
                    )
            };
        }
    );


function escolherQuadrado100x100(
    usuarioId,
    lado
) {

    return escolherTx.immediate(
        String(
            usuarioId
        ),
        lado
    );
}


// ========================================
// RESGATAR E PARAR
// ========================================

const resgatarTx =
    db.transaction(
        usuarioId => {

            const id =
                String(
                    usuarioId
                );


            const agora =
                Date.now();


            const periodo =
                obterPeriodoDiario();


            expirarPartidaAntiga(
                id,
                periodo,
                agora
            );


            const partida =
                buscarAtiva(
                    id,
                    periodo
                );


            if (
                !partida
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "sem_partida_ativa",

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            const pontosGanhos =
                Number(
                    partida
                        .premio_provisorio ||
                    0
                );


            if (
                pontosGanhos <= 0
            ) {

                return {

                    ok:
                        false,

                    motivo:
                        "sem_premio_para_resgatar",

                    estado:
                        montarEstado(
                            id,
                            periodo
                        )
                };
            }


            const usuarioAntes =
                buscarUsuario(
                    id
                );


            const saldoAntes =
                Number(
                    usuarioAntes
                        ?.pontos ||
                    0
                );


            const credito =
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
                    pontosGanhos,
                    agora,
                    agora,
                    id
                );


            if (
                credito.changes !==
                1
            ) {

                throw new Error(
                    "Usuário não encontrado ao resgatar o 100x100"
                );
            }


            db.prepare(`
                UPDATE jogo_100x100_partidas

                SET
                    status =
                        'resgatou',

                    atualizado_em =
                        ?,

                    encerrado_em =
                        ?

                WHERE
                    id = ?

                    AND status =
                        'ativa'
            `).run(
                agora,
                agora,
                partida.id
            );

            registrarEvento(
                id,

                "JOGO_100X100_RESGATE",

                pontosGanhos,

                {
                    periodo,

                    numeroPartida:
                        Number(
                            partida
                                .numero_partida
                        ),

                    tipoResultado:
                        "pontos",

                    premio:
                        `${pontosGanhos} pontos`,

                    pontosGanhos,

                    saldoAntes,

                    saldoDepois:
                        saldoAntes +
                        pontosGanhos,

                    linhaAlcancada:
                        Number(
                            partida
                                .linha_atual
                        )
                },
                agora
            );


            return {
                ok:
                    true,
                pontosGanhos,
                estado:
                    montarEstado(
                        id,
                        periodo
                    )
            };
        }
    );

function resgatar100x100(
    usuarioId
) {
    return resgatarTx.immediate(
        String(
            usuarioId
        )
    );
}

module.exports = {

    obterEstado100x100,

    iniciarPartida100x100,

    escolherQuadrado100x100,

    resgatar100x100
};