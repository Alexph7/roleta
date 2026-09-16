const path = require("path");
const Database = require("better-sqlite3");


const caminhoBanco =
    path.join(
        __dirname,
        "..",
        "roleta.db"
    );


const db =
    new Database(
        caminhoBanco,
        {
            readonly: true,
            fileMustExist: true
        }
    );


db.pragma(
    "busy_timeout = 5000"
);


// ========================================
// LER JSON COM SEGURANÇA
// ========================================

function lerDadosJson(
    valor
) {

    try {

        return JSON.parse(
            valor || "{}"
        );

    } catch {

        return {};
    }
}


// ========================================
// CONSULTAS
// ========================================

const buscarUsuario =
    db.prepare(`
        SELECT
            usuario_id,
            nome_exibicao,
            username,
            pontos,
            criado_em

        FROM usuarios

        WHERE usuario_id = ?

        LIMIT 1
    `);


const buscarGirosPontos =
    db.prepare(`
        SELECT
            dados_json

        FROM eventos_usuario

        WHERE
            usuario_id = ?
            AND tipo =
                'GIRO_ROLETA_PONTOS'

        ORDER BY id ASC
    `);


const contarBaus =
    db.prepare(`
        SELECT
            COUNT(*) AS total

        FROM eventos_usuario

        WHERE
            usuario_id = ?
            AND tipo =
                'BAU_SEGUNDA_CHANCE'
    `);


const buscarGirosPremiada =
    db.prepare(`
        SELECT
            tipo,
            dados_json

        FROM eventos_usuario

        WHERE
            usuario_id = ?

            AND tipo IN (
                'GIRO_ROLETA_PREMIADA_NORMAL',
                'GIRO_ROLETA_PREMIADA_BONUS'
            )

        ORDER BY id ASC
    `);


const buscarPosicaoRanking =
    db.prepare(`
        WITH ranking AS (

            SELECT
                u.usuario_id,

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

                        u.atingiu_pontuacao_em ASC,

                        u.criado_em ASC,

                        u.usuario_id ASC

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
            posicao

        FROM ranking

        WHERE usuario_id = ?

        LIMIT 1
    `);


// ========================================
// MONTAR PERFIL
// ========================================

function obterPerfilUsuario(
    usuarioId
) {

    const id =
        String(usuarioId);


    const usuario =
        buscarUsuario.get(
            id
        );


    if (!usuario) {

        return null;
    }


    const girosPontos =
        buscarGirosPontos.all(
            id
        );


    const girosPremiada =
        buscarGirosPremiada.all(
            id
        );


    const bau =
        contarBaus.get(
            id
        );


    const ranking =
        buscarPosicaoRanking.get(
            id
        );


    let diamantes = 0;

    let chancesPremiada = 0;

    let premiosDinheiro = 0;


    // ========================================
    // ROLETA DE PONTOS
    // ========================================

    for (
        const evento
        of girosPontos
    ) {

        const dados =
            lerDadosJson(
                evento.dados_json
            );


        if (
            dados.tipoResultado ===
            "diamante"
        ) {

            diamantes++;
        }


        if (
            dados.tipoResultado ===
            "roleta_premiada" ||

            Number(
                dados.girosPremiadaGanhos ||
                0
            ) > 0
        ) {

            chancesPremiada++;
        }
    }


    // ========================================
    // ROLETA PREMIADA
    // ========================================

    for (
        const evento
        of girosPremiada
    ) {

        const dados =
            lerDadosJson(
                evento.dados_json
            );


        const premio =
            String(
                dados.premio || ""
            );


        if (
            dados.tipoResultado ===
            "diamante" ||
            premio === "💎"
        ) {

            diamantes++;
        }


        if (
            premio.startsWith(
                "R$"
            )
        ) {

            premiosDinheiro++;
        }
    }


    return {

        id,
        nome:
            usuario.nome_exibicao,
        username:
            usuario.username,
        pontos:
            Number(
                usuario.pontos || 0
            ),
        posicao:
            ranking
                ? Number(
                    ranking.posicao
                )
                : null,
        girosPontos:
            girosPontos.length,

        diamantes,
        bausAbertos:
            Number(
                bau?.total || 0
            ),

        chancesPremiada,
        girosPremiada:
            girosPremiada.length,

        premiosDinheiro,
        criadoEm:
            Number(
                usuario.criado_em || 0
            )
    };
}

module.exports = {
    obterPerfilUsuario
};