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
// PERÍODO DA ROLETA DE PONTOS
// VIRA TODOS OS DIAS ÀS 08:30
// ========================================

const FUSO_HORARIO =
    "America/Sao_Paulo";

const HORA_GIRO_DIARIO =
    8;

const MINUTO_GIRO_DIARIO =
    30;


function obterPeriodoDiario(
    data = new Date()
) {
    const partes =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    FUSO_HORARIO,

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


    for (const parte of partes) {

        if (
            parte.type !==
            "literal"
        ) {
            valores[
                parte.type
            ] = parte.value;
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


    const antesDaRenovacao =
        hora <
        HORA_GIRO_DIARIO ||
        (
            hora ===
            HORA_GIRO_DIARIO &&
            minuto <
            MINUTO_GIRO_DIARIO
        );


    if (antesDaRenovacao) {

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
        String(ano) +
        "-" +
        String(mes)
            .padStart(
                2,
                "0"
            ) +
        "-" +
        String(dia)
            .padStart(
                2,
                "0"
            )
    );
}


// ========================================
// VOLTAR PERÍODOS
// ========================================

function deslocarPeriodo(
    periodo,
    quantidadeDias
) {
    const [
        ano,
        mes,
        dia
    ] =
        String(
            periodo
        )
            .split("-")
            .map(Number);


    const data =
        new Date(
            Date.UTC(
                ano,
                mes - 1,
                dia +
                quantidadeDias
            )
        );


    return (
        String(
            data.getUTCFullYear()
        ) +
        "-" +
        String(
            data.getUTCMonth() +
            1
        ).padStart(
            2,
            "0"
        ) +
        "-" +
        String(
            data.getUTCDate()
        ).padStart(
            2,
            "0"
        )
    );
}


// ========================================
// JSON
// ========================================

function lerDadosJson(
    texto
) {
    try {
        return JSON.parse(
            texto || "{}"
        );
    } catch {
        return {};
    }
}


// ========================================
// TODOS OS GIROS DA ROLETA DE PONTOS
// ========================================

const buscarGirosPontos =
    db.prepare(`
        SELECT
            e.id,
            e.usuario_id,
            e.dados_json,
            e.criado_em,
            u.nome_exibicao

        FROM eventos_usuario e

        INNER JOIN usuarios u
            ON u.usuario_id =
                e.usuario_id

        WHERE
            e.tipo =
                'GIRO_ROLETA_PONTOS'

        ORDER BY
            e.criado_em ASC,
            e.id ASC
    `);

// ========================================
// PREMIADOS DO RANKING DE PONTOS
// TOP 7
// ========================================

const buscarPremiadosPontos =
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
            usuario_id
        FROM ranking
        WHERE
            posicao <= 7
        ORDER BY
            posicao ASC
    `);

// ========================================
// PREMIADOS DO RANKING DE DIAMANTES
// TOP 3
// ========================================
const buscarPremiadosDiamantes =
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
                u.usuario_id
        )

        SELECT
            usuario_id
        FROM totais
        ORDER BY
            diamantes DESC,
            atingiu_diamantes_em
                ASC,

            usuario_id ASC

        LIMIT 3
    `);

// ========================================
// RANKING MÉDIA ATIVA
// ========================================
function obterRankingMediaAtiva(
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

    const periodoAtual =
        obterPeriodoDiario();

    const periodoAnterior =
        deslocarPeriodo(
            periodoAtual,
            -1
        );

    const periodoAnterior2 =
        deslocarPeriodo(
            periodoAtual,
            -2
        );

    const jogadores =
        new Map();

    const giros =
        buscarGirosPontos.all();

    for (const giro of giros) {

        const id =
            String(
                giro.usuario_id
            );
        if (
            !jogadores.has(id)
        ) {
            jogadores.set(
                id,
                {
                    usuarioId:
                        id,

                    nome:
                        giro.nome_exibicao ||
                        "Participante",

                    totalPontos:
                        0,

                    girosValidos:
                        0,

                    periodos:
                        new Set()
                }
            );
        }

        const jogador =
            jogadores.get(id);

        const dados =
            lerDadosJson(
                giro.dados_json
            );

        // ========================================
        // PRESENÇA
        // QUALQUER GIRO CONTA
        // INCLUSIVE ROLETA PREMIADA
        // ========================================
        let periodo =
            String(
                dados.periodoDiario ||
                ""
            ).trim();

        // Fallback para eventos antigos,
        // caso algum não tenha periodoDiario.
        if (
            !/^\d{4}-\d{2}-\d{2}$/
                .test(periodo)
        ) {
            periodo =
                obterPeriodoDiario(
                    new Date(
                        Number(
                            giro.criado_em
                        )
                    )
                );
        }

        jogador.periodos.add(
            periodo
        );

        // ========================================
        // MÉDIA HISTÓRICA
        // SÓ GIROS QUE DERAM PONTOS
        // ========================================
        const pontos =
            Math.max(
                0,
                Number(
                    dados.pontosGanhos ||
                    0
                )
            );

        if (pontos > 0) {

            jogador.totalPontos +=
                pontos;

            jogador.girosValidos++;
        }
    }

    const ativos = [];

    for (
        const jogador
        of jogadores.values()
    ) {

        // ========================================
        // REGRA DE PRESENÇA
        //
        // SE JÁ GIROU NO PERÍODO ATUAL:
        // atual + anterior
        //
        // SE AINDA NÃO GIROU:
        // anterior + anterior2
        // ========================================
        const girouNoAtual =
            jogador.periodos.has(
                periodoAtual
            );

        const primeiroPeriodo =
            girouNoAtual
                ? periodoAtual
                : periodoAnterior;

        const segundoPeriodo =
            girouNoAtual
                ? periodoAnterior
                : periodoAnterior2;

        const estaAtivo =
            jogador.periodos.has(
                primeiroPeriodo
            ) &&
            jogador.periodos.has(
                segundoPeriodo
            );

        if (!estaAtivo) {
            continue;
        }

        if (jogador.girosValidos < 6) {
            continue;
        }

        const media =
            jogador.girosValidos > 0

                ? Math.round(
                    jogador.totalPontos /
                    jogador.girosValidos
                )
                : 0;

        ativos.push({
            usuarioId:
                jogador.usuarioId,
            nome:
                jogador.nome,

            media,
            girosValidos:
                jogador.girosValidos
        });
    }

    // ========================================
    // CLASSIFICAÇÃO
    //
    // 1. MAIOR MÉDIA
    // 2. MAIS GIROS VÁLIDOS EM CASO DE EMPATE
    // 3. ID APENAS PARA ORDEM ESTÁVEL
    // ========================================
    ativos.sort(
        (a, b) =>

            b.media -
            a.media ||

            b.girosValidos -
            a.girosValidos ||

            a.usuarioId.localeCompare(
                b.usuarioId
            )
    );
    const todos =
        ativos.map(
            (
                jogador,
                indice
            ) => ({
                ...jogador,

                posicao:
                    indice + 1
            })
        );

    // ========================================
    // GANHADORES DA MÉDIA ATIVA
    //
    // NÃO PODE ESTAR ENTRE:
    // TOP 7 DE PONTOS
    // TOP 3 DE DIAMANTES
    // ========================================
    const premiadosPontos =
        new Set(
            buscarPremiadosPontos
                .all()
                .map(
                    item =>
                        String(
                            item.usuario_id
                        )
                )
        );

    const premiadosDiamantes =
        new Set(
            buscarPremiadosDiamantes
                .all()
                .map(
                    item =>
                        String(
                            item.usuario_id
                        )
                )
        );

    let posicaoPremio =
        0;

    for (const jogador of todos) {
        const jaPremiado =
            premiadosPontos.has(
                jogador.usuarioId
            ) ||
            premiadosDiamantes.has(
                jogador.usuarioId
            );

        jogador.ganhador =
            false;

        jogador.posicaoPremio =
            null;

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
            ) || null,

        periodoAtual
    };
}

module.exports = {
    obterRankingMediaAtiva
};