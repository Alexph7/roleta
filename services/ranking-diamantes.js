const path =
    require("path");

const Database =
    require("better-sqlite3");


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
// RANKING DE DIAMANTES
//
// Conta diamantes vindos de:
//
// - Roleta de Pontos
// - Roleta Premiada normal
// - Roleta Premiada bônus
//
// Desempate:
// quem atingiu primeiro a quantidade
// atual de diamantes.
// ========================================

const consultaRankingDiamantes =
    db.prepare(`
        WITH eventos_diamante AS (

            SELECT
                e.id,
                e.usuario_id,
                e.criado_em

            FROM eventos_usuario e

            WHERE
                e.tipo IN (
                    'GIRO_ROLETA_PONTOS',
                    'GIRO_ROLETA_PREMIADA_NORMAL',
                    'GIRO_ROLETA_PREMIADA_BONUS'
                )

                AND (
                    json_extract(
                        COALESCE(
                            e.dados_json,
                            '{}'
                        ),
                        '$.tipoResultado'
                    ) = 'diamante'

                    OR

                    json_extract(
                        COALESCE(
                            e.dados_json,
                            '{}'
                        ),
                        '$.premio'
                    ) = '💎'
                )
        ),

        totais AS (

            SELECT
                u.usuario_id,
                u.nome_exibicao,

                COUNT(
                    d.id
                ) AS diamantes,

                MAX(
                    d.criado_em
                ) AS atingiu_diamantes_em

            FROM usuarios u

            INNER JOIN
                eventos_diamante d

                ON d.usuario_id =
                    u.usuario_id

            GROUP BY
                u.usuario_id,
                u.nome_exibicao
        ),

        ranking AS (

            SELECT
                usuario_id,
                nome_exibicao,
                diamantes,
                atingiu_diamantes_em,

                ROW_NUMBER() OVER (

                    ORDER BY
                        diamantes DESC,

                        atingiu_diamantes_em
                            ASC,

                        usuario_id ASC

                ) AS posicao

            FROM totais
        )

        SELECT
            usuario_id,
            nome_exibicao,
            diamantes,
            posicao

        FROM ranking

        ORDER BY
            posicao ASC
    `);

// ========================================
// NORMALIZAR
// ========================================

function normalizarLinha(
    linha
) {
    return {
        usuarioId:
            String(
                linha.usuario_id
            ),
        nome:
            linha.nome_exibicao,
        diamantes:
            Number(
                linha.diamantes || 0
            ),
        posicao:
            Number(
                linha.posicao
            )
    };
}

// ========================================
// OBTER RANKING
// ========================================

function obterRankingDiamantes(
    usuarioId,
    limite = 30
) {
    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                100,
                Math.trunc(
                    Number(limite) || 30
                )
            )
        );

    const todos =
        consultaRankingDiamantes
            .all()
            .map(
                normalizarLinha
            );


    const id =
        String(
            usuarioId
        );


    return {
        ranking:
            todos.slice(
                0,
                limiteSeguro
            ),

        usuario:
            todos.find(
                item =>
                    item.usuarioId === id
            ) || null
    };
}

module.exports = {
    obterRankingDiamantes
};