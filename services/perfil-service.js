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

const buscarHistoricoPontosPerfil =
    db.prepare(`
        SELECT
            tipo,
            origem,
            valor,
            dados_json,
            criado_em
        FROM eventos_usuario
        WHERE
            usuario_id = ?
            AND tipo IN (
                'GIRO_ROLETA_PONTOS',
                'BAU_SEGUNDA_CHANCE',
                'GIRO_ROLETA_PREMIADA_NORMAL',
                'GIRO_ROLETA_PREMIADA_BONUS'
            )
        ORDER BY
            criado_em DESC,
            id DESC
        LIMIT 100
    `);

const buscarGirosPremiadaNormal =
    db.prepare(`
        SELECT
            premio
        FROM giros
        WHERE
            usuario_id = ?
        ORDER BY id ASC
    `);

const buscarGirosPremiadaBonus =
    db.prepare(`
        SELECT
            dados_json
        FROM eventos_usuario
        WHERE
            usuario_id = ?
            AND tipo =
                'GIRO_ROLETA_PREMIADA_BONUS'
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
    const girosPremiadaNormal =
        buscarGirosPremiadaNormal.all(
            id
        );
    const girosPremiadaBonus =
        buscarGirosPremiadaBonus.all(
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
    const eventosHistorico =
        buscarHistoricoPontosPerfil.all(
            id
        );

    let diamantes = 0;
    let totalPontosGanhos = 0;

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
        totalPontosGanhos +=
            Math.max(
                0,
                Number(
                    dados.pontosGanhos || 0
                )
            );
        if (
            dados.tipoResultado ===
            "diamante"
        ) {
            diamantes++;
        }
    }

    // ========================================
    // ROLETA PREMIADA NORMAL
    // ========================================
    for (
        const giro
        of girosPremiadaNormal
    ) {
        const premio =
            String(
                giro.premio || ""
            );
        if (
            premio === "💎"
        ) {
            diamantes++;
        }
    }

    // ========================================
    // ROLETA PREMIADA BÔNUS
    // ========================================
    for (
        const evento
        of girosPremiadaBonus
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
    }

    const mediaPontosPorGiro =
        girosPontos.length > 0
            ? Math.round(
                totalPontosGanhos /
                girosPontos.length
            )
            : 0;

    const historicoPontos = [];

    for (
        const evento
        of eventosHistorico
    ) {
        const dados =
            lerDadosJson(
                evento.dados_json
            );

        const pontos =
            Math.max(
                0,
                Math.trunc(
                    Number(
                        dados.pontosGanhos ??
                        evento.valor ??
                        0
                    ) || 0
                )
            );

        // Só mostra eventos que
        // realmente deram pontos.
        if (pontos <= 0) {
            continue;
        }

        let icone =
            "🎯";

        let origem =
            "Roleta de Pontos";

        let multiplicador =
            null;

        // ========================================
        // ROLETA DE PONTOS
        // ========================================
        if (
            evento.tipo ===
            "GIRO_ROLETA_PONTOS"
        ) {
            if (
                dados.tipoResultado ===
                "diamante"
            ) {
                icone =
                    "💎";
            }
            if (
                dados.teveMultiplicador ===
                true &&
                Number(
                    dados.multiplicador || 0
                ) > 0
            ) {
                multiplicador =
                    Number(
                        dados.multiplicador
                    );
            }
        }

        // ========================================
        // BAÚ
        // ========================================
        if (
            evento.tipo ===
            "BAU_SEGUNDA_CHANCE"
        ) {
            icone =
                "🎁";

            origem =
                "Baú da Segunda Chance";
        }

        // ========================================
        // ROLETA PREMIADA
        // ========================================
        if (
            evento.tipo ===
            "GIRO_ROLETA_PREMIADA_NORMAL" ||
            evento.tipo ===
            "GIRO_ROLETA_PREMIADA_BONUS"
        ) {
            icone =
                dados.tipoResultado ===
                    "diamante"
                    ? "🎡💎"
                    : "🎡";

            origem =
                "Roleta Premiada";
        }

        historicoPontos.push({
            icone,
            origem,
            pontos,
            multiplicador,
            criadoEm:
                Number(
                    evento.criado_em || 0
                )
        });

        // Só os 10 ganhos mais recentes.
        if (
            historicoPontos.length >= 10
        ) {
            break;
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
        mediaPontosPorGiro,
        diamantes,
        bausAbertos:
            Number(
                bau?.total || 0
            ),

        girosPremiada:
            girosPremiadaNormal.length +
            girosPremiadaBonus.length,

        historicoPontos,

        criadoEm:
            Number(
                usuario.criado_em || 0
            )
    };
}

module.exports = {
    obterPerfilUsuario
};