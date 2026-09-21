const path =
    require("path");

const Database =
    require("better-sqlite3");

const {
    listarRankingPontos
} = require(
    "../database"
);

const {
    obterRankingDiamantes
} = require(
    "./ranking-diamantes"
);

const {
    obterRankingMediaAtiva
} = require(
    "./ranking-media-ativa"
);

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
// RANKING DE PONTOS DOS BAÚS
// ========================================
const consultaRankingBaus =
    db.prepare(`
        WITH pontos_bau AS (
            SELECT
                e.usuario_id,
                COALESCE(
                    CAST(
                        json_extract(
                            COALESCE(
                                e.dados_json,
                                '{}'
                            ),
                            '$.pontosGanhos'
                        )
                        AS INTEGER
                    ),
                    0
                ) AS pontos_ganhos,
                e.criado_em
            FROM eventos_usuario e
            WHERE
                e.tipo =
                    'BAU_SEGUNDA_CHANCE'

                AND COALESCE(
                    CAST(
                        json_extract(
                            COALESCE(
                                e.dados_json,
                                '{}'
                            ),
                            '$.pontosGanhos'
                        )
                        AS INTEGER
                    ),
                    0
                ) > 0
        ),
        totais AS (
            SELECT
                u.usuario_id,
                u.nome_exibicao,

                SUM(
                    p.pontos_ganhos
                ) AS pontos_baus,

                MAX(
                    p.criado_em
                ) AS atingiu_pontos_baus_em
            FROM usuarios u
            INNER JOIN
                pontos_bau p

                ON p.usuario_id =
                    u.usuario_id

            GROUP BY
                u.usuario_id,
                u.nome_exibicao
        ),

        ranking AS (
            SELECT
                usuario_id,
                nome_exibicao,
                pontos_baus,
                atingiu_pontos_baus_em,

                ROW_NUMBER() OVER (

                    ORDER BY
                        pontos_baus DESC,

                        atingiu_pontos_baus_em
                            ASC,

                        usuario_id ASC
                ) AS posicao
            FROM totais
        )
        SELECT
            usuario_id,
            nome_exibicao,
            pontos_baus,
            posicao

        FROM ranking

        ORDER BY
            posicao ASC
    `);


// ========================================
// OBTER RANKING
// ========================================
function obterRankingBaus(
    usuarioId,
    limite = 40
) {
    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                100,
                Math.trunc(
                    Number(limite) ||
                    40
                )
            )
        );

    const todos =
        consultaRankingBaus
            .all()
            .map(
                item => ({
                    usuarioId:
                        String(
                            item.usuario_id
                        ),
                    nome:
                        item.nome_exibicao ||
                        "Participante",
                    pontosBaus:
                        Number(
                            item.pontos_baus ||
                            0
                        ),
                    posicao:
                        Number(
                            item.posicao
                        ),
                    ganhador:
                        false,
                    posicaoPremio:
                        null
                })
            );

    // ========================================
    // TOP 7 DO RANKING DE PONTOS
    // ========================================
    const premiadosPontos =
        new Set(
            listarRankingPontos(
                7
            ).map(
                item =>
                    String(
                        item.usuario_id
                    )
            )
        );

    // ========================================
    // TOP 3 DE DIAMANTES
    // ========================================
    const premiadosDiamantes =
        new Set(
            obterRankingDiamantes(
                "0",
                3
            )
                .ranking
                .map(
                    item =>
                        String(
                            item.usuarioId
                        )
                )
        );

    // ========================================
    // GANHADORES DA MÉDIA ATIVA
    // ========================================
    const premiadosMediaAtiva =
        new Set(
            obterRankingMediaAtiva(
                "0",
                40
            )
                .ranking
                .filter(
                    item =>
                        item.ganhador ===
                        true
                )
                .map(
                    item =>
                        String(
                            item.usuarioId
                        )
                )
        );

    // ========================================
    // 3 PRIMEIROS ELEGÍVEIS
    // ========================================
    let posicaoPremio =
        0;

    for (const jogador of todos) {

        const jaPremiado =
            premiadosPontos.has(
                jogador.usuarioId
            ) ||
            premiadosDiamantes.has(
                jogador.usuarioId
            ) ||
            premiadosMediaAtiva.has(
                jogador.usuarioId
            );

        if (
            !jaPremiado &&
            posicaoPremio < 3
        ) {
            posicaoPremio++;

            jogador.ganhador =
                true;
            jogador.posicaoPremio =
                posicaoPremio;
        }
    }

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
                    item.usuarioId ===
                    id
            ) || null
    };
}

module.exports = {
    obterRankingBaus
};