const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(
    path.join(__dirname, "..", "roleta.db"),
    {
        readonly: true,
        fileMustExist: true
    }
);

db.pragma("busy_timeout = 5000");

const FUSO_HORARIO =
    "America/Sao_Paulo";


function num(valor) {
    const n =
        Number(valor || 0);

    return Number.isFinite(n)
        ? n
        : 0;
}


function lerJson(texto) {
    try {
        return JSON.parse(
            texto || "{}"
        );
    } catch {
        return {};
    }
}


function noticia(
    tipo,
    icone,
    titulo,
    descricao,
    usuarioId,
    criadoEm
) {
    return {
        tipo,
        icone,
        titulo,
        descricao,

        usuarioId:
            String(usuarioId),

        criadoEm:
            num(criadoEm),

        destaque:
            true
    };
}


// ========================================
// MOVIMENTAÇÕES DO TOP 3
// ========================================

function registrarTop3(
    noticias,
    antes,
    depois,
    criadoEm,
    ranking
) {
    const posAntes =
        new Map(
            antes.map(
                (item, indice) => [
                    item.id,
                    indice + 1
                ]
            )
        );


    const ehMedia =
        ranking ===
        "media";


    const prefixo =
        ehMedia
            ? "media"
            : "baus";


    const icone =
        ehMedia
            ? "📊"
            : "🎁";


    for (
        let indice = 0;
        indice <
        Math.min(
            3,
            depois.length
        );
        indice++
    ) {
        const item =
            depois[indice];


        const nova =
            indice + 1;


        const antiga =
            posAntes.has(
                item.id
            )
                ? posAntes.get(
                    item.id
                )
                : null;


        // Só noticia quem SUBIU.
        //
        // Exemplo:
        // caiu de 1º para 2º
        // NÃO "assumiu a vice".
        if (
            antiga !== null &&
            antiga <= nova
        ) {
            continue;
        }


        if (
            nova ===
            1
        ) {
            noticias.push(
                noticia(
                    `novo_lider_${prefixo}`,

                    `${icone}👑`,

                    ehMedia
                        ? `${item.nome} assumiu a liderança da Média Ativa`
                        : `${item.nome} assumiu a liderança dos Baús`,

                    ehMedia
                        ? "Ranking de Média Ativa"
                        : "Ranking de Baús",

                    item.id,

                    criadoEm
                )
            );


            continue;
        }


        if (
            nova ===
            2
        ) {
            noticias.push(
                noticia(
                    `novo_vice_${prefixo}`,

                    `${icone}🥈`,

                    ehMedia
                        ? `${item.nome} assumiu a vice-liderança da Média Ativa`
                        : `${item.nome} assumiu a vice-liderança dos Baús`,

                    "Agora está em 2º lugar",

                    item.id,

                    criadoEm
                )
            );


            continue;
        }


        noticias.push(
            noticia(
                `top3_${prefixo}`,

                `${icone}🏅`,

                ehMedia
                    ? `${item.nome} entrou no Top 3 da Média Ativa`
                    : `${item.nome} entrou no Top 3 dos Baús`,

                "Agora está em 3º lugar",

                item.id,

                criadoEm
            )
        );
    }
}


// ========================================
// DATA / PERÍODO DA MÉDIA ATIVA
// ========================================

const formatadorData =
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
    );


function partesLocais(
    timestamp
) {
    const valores = {};


    for (
        const parte
        of formatadorData
            .formatToParts(
                new Date(
                    timestamp
                )
            )
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


    return {
        ano:
            Number(
                valores.year
            ),

        mes:
            Number(
                valores.month
            ),

        dia:
            Number(
                valores.day
            ),

        hora:
            Number(
                valores.hour
            ),

        minuto:
            Number(
                valores.minute
            )
    };
}


function deslocarPeriodo(
    periodo,
    dias
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
                dia + dias
            )
        );


    return (
        String(
            data.getUTCFullYear()
        ) +
        "-" +
        String(
            data.getUTCMonth() + 1
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


function periodoPorTimestamp(
    timestamp
) {
    const local =
        partesLocais(
            timestamp
        );


    let ano =
        local.ano;

    let mes =
        local.mes;

    let dia =
        local.dia;


    const antesDas0830 =
        local.hora < 8 ||
        (
            local.hora === 8 &&
            local.minuto < 30
        );


    if (antesDas0830) {
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
                .getUTCMonth() + 1;

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


function periodoDoEvento(
    evento
) {
    const salvo =
        String(
            evento.dados
                ?.periodoDiario ||
            ""
        ).trim();


    if (
        /^\d{4}-\d{2}-\d{2}$/
            .test(
                salvo
            )
    ) {
        return salvo;
    }


    return periodoPorTimestamp(
        evento.criadoEm
    );
}


// ========================================
// HORÁRIO EXATO DA VIRADA 08:30
// ========================================

function timestampInicioPeriodo(
    periodo
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


    const alvoLocal =
        Date.UTC(
            ano,
            mes - 1,
            dia,
            8,
            30
        );


    let estimado =
        Date.UTC(
            ano,
            mes - 1,
            dia,
            11,
            30
        );


    for (
        let tentativa = 0;
        tentativa < 3;
        tentativa++
    ) {
        const local =
            partesLocais(
                estimado
            );


        const localComoUtc =
            Date.UTC(
                local.ano,
                local.mes - 1,
                local.dia,
                local.hora,
                local.minuto
            );


        const ajuste =
            alvoLocal -
            localComoUtc;


        estimado +=
            ajuste;


        if (
            ajuste ===
            0
        ) {
            break;
        }
    }


    return estimado;
}


// ========================================
// GERAR NEWS EXTRAS
// ========================================

function gerarNoticiasRankingsExtras() {

    const eventos =
        db.prepare(`
            SELECT
                e.id,
                e.usuario_id,
                e.tipo,
                e.dados_json,
                e.criado_em,
                u.nome_exibicao

            FROM eventos_usuario e

            INNER JOIN usuarios u
                ON u.usuario_id =
                    e.usuario_id

            WHERE e.tipo IN (
                'GIRO_ROLETA_PONTOS',
                'BAU_SEGUNDA_CHANCE'
            )

            ORDER BY
                e.criado_em ASC,
                e.id ASC
        `)
            .all()
            .map(
                evento => ({
                    id:
                        evento.id,

                    usuarioId:
                        String(
                            evento.usuario_id
                        ),

                    nome:
                        evento.nome_exibicao ||
                        "Participante",

                    tipo:
                        evento.tipo,

                    dados:
                        lerJson(
                            evento.dados_json
                        ),

                    criadoEm:
                        num(
                            evento.criado_em
                        )
                })
            );


    const noticias = [];


    // ========================================
    // RANKING DE BAÚS
    // ========================================

    const pontosBaus =
        new Map();

    const atingiuBaus =
        new Map();

    const nomesBaus =
        new Map();


    function rankingBaus() {

        return [
            ...pontosBaus.entries()
        ]
            .map(
                (
                    [
                        id,
                        pontos
                    ]
                ) => ({
                    id,

                    nome:
                        nomesBaus.get(
                            id
                        ) ||
                        "Participante",

                    pontos,

                    atingiuEm:
                        num(
                            atingiuBaus.get(
                                id
                            )
                        )
                })
            )
            .filter(
                item =>
                    item.pontos >
                    0
            )
            .sort(
                (a, b) =>
                    b.pontos -
                    a.pontos ||

                    a.atingiuEm -
                    b.atingiuEm ||

                    String(
                        a.id
                    ).localeCompare(
                        String(
                            b.id
                        )
                    )
            );
    }


    for (
        const evento
        of eventos
    ) {
        if (
            evento.tipo !==
            "BAU_SEGUNDA_CHANCE"
        ) {
            continue;
        }


        // IMPORTANTE:
        // usa SOMENTE pontosGanhos.
        //
        // Baú que deu +1 giro
        // não soma nada.
        const pontos =
            Math.max(
                0,
                Math.trunc(
                    num(
                        evento.dados
                            ?.pontosGanhos
                    )
                )
            );


        if (
            pontos <=
            0
        ) {
            continue;
        }


        const antes =
            rankingBaus();


        nomesBaus.set(
            evento.usuarioId,
            evento.nome
        );


        pontosBaus.set(
            evento.usuarioId,

            num(
                pontosBaus.get(
                    evento.usuarioId
                )
            ) +
            pontos
        );


        atingiuBaus.set(
            evento.usuarioId,
            evento.criadoEm
        );


        const depois =
            rankingBaus();


        registrarTop3(
            noticias,
            antes,
            depois,
            evento.criadoEm,
            "baus"
        );
    }


    // ========================================
    // RANKING MÉDIA ATIVA
    // ========================================
    const jogadores =
        new Map();

    function rankingMedia(
        periodoAtual
    ) {
        const anterior =
            deslocarPeriodo(
                periodoAtual,
                -1
            );

        const anterior2 =
            deslocarPeriodo(
                periodoAtual,
                -2
            );

        const ativos = [];

        for (
            const jogador
            of jogadores.values()
        ) {
            const girouAtual =
                jogador.periodos.has(
                    periodoAtual
                );

            const primeiroPeriodo =
                girouAtual
                    ? periodoAtual
                    : anterior;

            const segundoPeriodo =
                girouAtual
                    ? anterior
                    : anterior2;

            if (
                !jogador.periodos.has(
                    primeiroPeriodo
                ) ||
                !jogador.periodos.has(
                    segundoPeriodo
                )
            ) {
                continue;
            }

            const media =
                jogador.girosValidos >
                0
                    ? Math.round(
                        jogador.totalPontos /
                        jogador.girosValidos
                    )
                    : 0;

            ativos.push({
                id:
                    jogador.id,
                nome:
                    jogador.nome,
                media,
                girosValidos:
                    jogador.girosValidos
            });
        }

        return ativos.sort(
            (a, b) =>
                b.media -
                a.media ||

                b.girosValidos -
                a.girosValidos ||

                String(
                    a.id
                ).localeCompare(
                    String(
                        b.id
                    )
                )
        );
    }

    const eventosMedia =
        eventos.filter(
            evento =>
                evento.tipo ===
                "GIRO_ROLETA_PONTOS"
        );

    if (
        eventosMedia.length >
        0
    ) {
        const primeiroPeriodo =
            periodoDoEvento(
                eventosMedia[0]
            );

        const periodoAtual =
            periodoPorTimestamp(
                Date.now()
            );

        const linhaDoTempo =
            eventosMedia.map(
                evento => ({
                    tipo:
                        "evento",
                    timestamp:
                        evento.criadoEm,

                    evento
                })
            );

        // ========================================
        // VIRADAS DAS 08:30
        //
        // Necessário porque alguém pode perder
        // elegibilidade mesmo sem girar.
        // ========================================
        let periodo =
            deslocarPeriodo(
                primeiroPeriodo,
                1
            );

        while (
            periodo <=
            periodoAtual
        ) {
            linhaDoTempo.push({
                tipo:
                    "virada",
                timestamp:
                    timestampInicioPeriodo(
                        periodo
                    ),
                periodo
            });

            periodo =
                deslocarPeriodo(
                    periodo,
                    1
                );
        }

        linhaDoTempo.sort(
            (a, b) =>
                a.timestamp -
                b.timestamp ||

                (
                    a.tipo ===
                    b.tipo
                        ? 0
                        : a.tipo ===
                            "virada"

                            ? -1
                            : 1
                )
        );

        for (
            const item
            of linhaDoTempo
        ) {
            // ========================================
            // VIRADA 08:30
            // ========================================
            if (
                item.tipo ===
                "virada"
            ) {
                const anterior =
                    deslocarPeriodo(
                        item.periodo,
                        -1
                    );

                registrarTop3(
                    noticias,

                    rankingMedia(
                        anterior
                    ),

                    rankingMedia(
                        item.periodo
                    ),

                    item.timestamp,

                    "media"
                );
                continue;
            }

            // ========================================
            // GIRO DA ROLETA DE PONTOS
            // ========================================
            const evento =
                item.evento;

            const periodoEvento =
                periodoDoEvento(
                    evento
                );

            const antes =
                rankingMedia(
                    periodoEvento
                );

            if (
                !jogadores.has(
                    evento.usuarioId
                )
            ) {
                jogadores.set(
                    evento.usuarioId,
                    {
                        id:
                            evento.usuarioId,
                        nome:
                            evento.nome,
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
                jogadores.get(
                    evento.usuarioId
                );

            jogador.nome =
                evento.nome;

            // Qualquer giro conta presença,
            // inclusive resultado sem pontos.
            jogador.periodos.add(
                periodoEvento
            );

            const pontos =
                Math.max(
                    0,
                    Number(
                        evento.dados
                            ?.pontosGanhos ||
                        0
                    )
                );

            // Na média só entram
            // os giros que deram pontos.
            if (
                pontos >
                0
            ) {
                jogador.totalPontos +=
                    pontos;

                jogador.girosValidos++;
            }

            const depois =
                rankingMedia(
                    periodoEvento
                );

            registrarTop3(
                noticias,
                antes,
                depois,
                evento.criadoEm,
                "media"
            );
        }
    }

    return noticias;
}

module.exports = {
    gerarNoticiasRankingsExtras
};