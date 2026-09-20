const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(
    path.join(
        __dirname,
        "..",
        "roleta.db"
    ),
    {
        readonly: true,
        fileMustExist: true
    }
);

db.pragma(
    "busy_timeout = 5000"
);

const CACHE_MS =
    30 * 1000;

const SALTO_MINIMO =
    7;

const PASSO_MARCO =
    5000;


let cache = {
    criadoEm: 0,
    noticias: []
};


// ========================================
// AUXILIARES
// ========================================

function json(
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


function num(
    valor
) {
    const n =
        Number(
            valor || 0
        );

    return Number.isFinite(n)
        ? n
        : 0;
}


function pts(
    valor
) {
    return Math.trunc(
        num(valor)
    ).toLocaleString(
        "pt-BR"
    );
}


function pontosDoEvento(
    evento,
    dados
) {
    return Math.max(
        0,
        Math.trunc(
            num(
                dados.pontosGanhos ??
                evento.valor ??
                0
            )
        )
    );
}


function eventoEhDiamante(
    evento,
    dados
) {
    return (
        evento.tipo !==
        "BAU_SEGUNDA_CHANCE" &&

        (
            String(
                dados.tipoResultado ||
                ""
            ) ===
            "diamante" ||

            String(
                dados.premio ||
                ""
            ) ===
            "💎"
        )
    );
}


// ========================================
// REGRA DO RANKING DE PONTOS
// MESMA ORDEM DO RANKING REAL
// ========================================

function compararPontos(
    a,
    b
) {
    if (
        a.pontos !==
        b.pontos
    ) {
        return (
            b.pontos -
            a.pontos
        );
    }


    const dataA =
        num(
            a.atingiuEm
        );

    const dataB =
        num(
            b.atingiuEm
        );


    if (
        !!dataA !==
        !!dataB
    ) {
        return dataA
            ? -1
            : 1;
    }


    if (
        dataA &&
        dataB &&
        dataA !== dataB
    ) {
        return (
            dataA -
            dataB
        );
    }


    if (
        a.criadoEm !==
        b.criadoEm
    ) {
        return (
            a.criadoEm -
            b.criadoEm
        );
    }


    return String(
        a.id
    ).localeCompare(
        String(
            b.id
        )
    );
}


function rankingPontos(
    estado,
    girosRestantes
) {
    return [
        ...estado.values()
    ]
        .filter(
            item =>
                item.pontos > 0 ||

                num(
                    girosRestantes.get(
                        item.id
                    )
                ) > 0
        )
        .sort(
            compararPontos
        );
}


// ========================================
// OBJETO DE NOTÍCIA
// ========================================

function noticia({
    tipo,
    icone,
    titulo,
    descricao,
    usuarioId = null,
    criadoEm,
    destaque = false
}) {
    return {
        tipo,
        icone,
        titulo,
        descricao,

        usuarioId:
            usuarioId === null
                ? null
                : String(
                    usuarioId
                ),

        criadoEm:
            num(
                criadoEm
            ),

        destaque:
            destaque === true
    };
}


// ========================================
// GERAR NEWS
// ========================================

function gerarNoticias() {

    const usuarios =
        db.prepare(`
            SELECT
                usuario_id,
                nome_exibicao,
                pontos,
                atingiu_pontuacao_em,
                criado_em
            FROM usuarios
        `).all();


    const eventosBrutos =
        db.prepare(`
            SELECT
                id,
                usuario_id,
                tipo,
                origem,
                valor,
                dados_json,
                criado_em

            FROM eventos_usuario

            WHERE tipo IN (
                'GIRO_ROLETA_PONTOS',
                'BAU_SEGUNDA_CHANCE',
                'GIRO_ROLETA_PREMIADA_NORMAL',
                'GIRO_ROLETA_PREMIADA_BONUS'
            )

            ORDER BY
                criado_em DESC,
                id DESC
        `).all();


    const nomes =
        new Map();

    const estado =
        new Map();

    const girosRestantes =
        new Map();

    const ganhosPositivos =
        new Map();


    // ========================================
    // ESTADO ATUAL
    // ========================================

    for (
        const u
        of usuarios
    ) {
        const id =
            String(
                u.usuario_id
            );

        const nome =
            String(
                u.nome_exibicao ||
                "Participante"
            );


        nomes.set(
            id,
            nome
        );


        estado.set(
            id,
            {
                id,
                nome,

                pontos:
                    Math.max(
                        0,
                        Math.trunc(
                            num(
                                u.pontos
                            )
                        )
                    ),

                atingiuEm:
                    num(
                        u.atingiu_pontuacao_em
                    ) || null,

                criadoEm:
                    num(
                        u.criado_em
                    )
            }
        );


        girosRestantes.set(
            id,
            0
        );


        ganhosPositivos.set(
            id,
            []
        );
    }


    // ========================================
    // PREPARA EVENTOS
    // ========================================

    const eventos =
        eventosBrutos.map(
            evento => {

                const usuarioId =
                    String(
                        evento.usuario_id
                    );


                const dados =
                    json(
                        evento.dados_json
                    );


                const criadoEm =
                    num(
                        evento.criado_em
                    );


                const pontos =
                    pontosDoEvento(
                        evento,
                        dados
                    );


                if (
                    !estado.has(
                        usuarioId
                    )
                ) {
                    estado.set(
                        usuarioId,
                        {
                            id:
                                usuarioId,

                            nome:
                                "Participante",

                            pontos:
                                0,

                            atingiuEm:
                                null,

                            criadoEm
                        }
                    );


                    nomes.set(
                        usuarioId,
                        "Participante"
                    );


                    girosRestantes.set(
                        usuarioId,
                        0
                    );


                    ganhosPositivos.set(
                        usuarioId,
                        []
                    );
                }


                if (
                    evento.tipo ===
                    "GIRO_ROLETA_PONTOS"
                ) {
                    girosRestantes.set(
                        usuarioId,

                        num(
                            girosRestantes.get(
                                usuarioId
                            )
                        ) + 1
                    );
                }


                if (
                    pontos > 0
                ) {
                    ganhosPositivos
                        .get(
                            usuarioId
                        )
                        .push(
                            criadoEm
                        );
                }


                return {
                    ...evento,

                    usuarioId,
                    dados,
                    criadoEm,
                    pontos
                };
            }
        );


    for (
        const lista
        of ganhosPositivos.values()
    ) {
        lista.sort(
            (
                a,
                b
            ) =>
                a - b
        );
    }


    const indiceGanho =
        new Map(
            [
                ...ganhosPositivos.entries()
            ].map(
                (
                    [
                        id,
                        lista
                    ]
                ) => [
                        id,
                        lista.length
                    ]
            )
        );


    const noticias = [];

    const mudancasLiderPontos =
        [];


    // ========================================
    // PERCORRE DO PRESENTE PARA O PASSADO
    // ========================================

    for (
        const evento
        of eventos
    ) {
        const id =
            evento.usuarioId;


        const usuario =
            estado.get(
                id
            );


        const nome =
            usuario?.nome ||
            "Participante";


        const dados =
            evento.dados;


        // ========================================
        // DIAMANTE
        // ========================================

        if (
            eventoEhDiamante(
                evento,
                dados
            )
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "diamante",

                    icone:
                        "💎",

                    titulo:
                        `${nome} encontrou um diamante`,

                    descricao:
                        evento.tipo ===
                            "GIRO_ROLETA_PONTOS"
                            ? "Roleta de Pontos"
                            : "Roleta Premiada",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm
                })
            );
        }


        // ========================================
        // PRÊMIO EM DINHEIRO
        // ========================================

        if (
            (
                evento.tipo ===
                "GIRO_ROLETA_PREMIADA_NORMAL" ||

                evento.tipo ===
                "GIRO_ROLETA_PREMIADA_BONUS"
            ) &&

            dados.ehPremio ===
            true &&

            String(
                dados.premio || ""
            ).startsWith(
                "R$"
            )
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "premio_roleta",

                    icone:
                        "🎡",

                    titulo:
                        `${nome} ganhou ${dados.premio}`,

                    descricao:
                        "Roleta Premiada",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                })
            );
        }


        // ========================================
        // PONTOS NO BAÚ
        // ========================================

        if (
            evento.tipo ===
            "BAU_SEGUNDA_CHANCE" &&

            evento.pontos >
            0
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "bau_pontos",

                    icone:
                        "🎁",

                    titulo:
                        `${nome} encontrou ${pts(
                            evento.pontos
                        )} pontos no baú`,

                    descricao:
                        "Baú da Segunda Chance",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm
                })
            );
        }


        // ========================================
        // GIRO GRANDE
        // 1000+ PONTOS
        // DIAMANTE NÃO DUPLICA ESSA NEWS
        // ========================================

        if (
            evento.tipo ===
            "GIRO_ROLETA_PONTOS" &&

            evento.pontos >=
            1000 &&

            !eventoEhDiamante(
                evento,
                dados
            )
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "giro_alto",

                    icone:
                        "⚡",

                    titulo:
                        `${nome} ganhou ${pts(
                            evento.pontos
                        )} pontos em um único giro`,

                    descricao:
                        "Roleta de Pontos",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm
                })
            );
        }


        // ========================================
        // SEM PONTOS:
        // NÃO HÁ MOVIMENTO NO RANKING
        // ========================================

        if (
            !usuario ||
            evento.pontos <= 0
        ) {
            if (
                evento.tipo ===
                "GIRO_ROLETA_PONTOS"
            ) {
                girosRestantes.set(
                    id,

                    Math.max(
                        0,

                        num(
                            girosRestantes.get(
                                id
                            )
                        ) - 1
                    )
                );
            }


            continue;
        }


        // ========================================
        // RANKING DEPOIS DO EVENTO
        // ========================================

        const rankingDepois =
            rankingPontos(
                estado,
                girosRestantes
            );


        const posDepois =
            rankingDepois.findIndex(
                item =>
                    item.id === id
            ) + 1;


        const liderDepois =
            rankingDepois[
            0
            ] || null;

        const viceDepois =
            rankingDepois[
            1
            ] || null;

        const pontosDepois =
            usuario.pontos;


        const pontosAntes =
            Math.max(
                0,

                pontosDepois -
                evento.pontos
            );


        // ========================================
        // VOLTA O BANCO EM MEMÓRIA
        // PARA ANTES DO EVENTO
        // ========================================

        usuario.pontos =
            pontosAntes;


        const novoIndice =
            Math.max(
                0,

                num(
                    indiceGanho.get(
                        id
                    )
                ) - 1
            );


        indiceGanho.set(
            id,
            novoIndice
        );


        const tempos =
            ganhosPositivos.get(
                id
            ) || [];


        usuario.atingiuEm =
            novoIndice > 0
                ? tempos[
                novoIndice - 1
                ]
                : null;


        if (
            evento.tipo ===
            "GIRO_ROLETA_PONTOS"
        ) {
            girosRestantes.set(
                id,

                Math.max(
                    0,

                    num(
                        girosRestantes.get(
                            id
                        )
                    ) - 1
                )
            );
        }


        // ========================================
        // RANKING ANTES DO EVENTO
        // ========================================

        const rankingAntes =
            rankingPontos(
                estado,
                girosRestantes
            );


        const indiceAntes =
            rankingAntes.findIndex(
                item =>
                    item.id === id
            );


        const posAntes =
            indiceAntes >= 0
                ? indiceAntes + 1
                : null;


        const liderAntes =
            rankingAntes[
            0
            ] || null;

        const viceAntes =
            rankingAntes[
            1
            ] || null;

        // ========================================
        // ASSUMIU A LIDERANÇA
        // ========================================

        if (
            liderDepois?.id ===
            id &&

            liderAntes?.id !==
            id
        ) {
            const item =
                noticia({
                    tipo:
                        "novo_lider_pontos",

                    icone:
                        "👑",

                    titulo:
                        `${nome} assumiu a liderança do ranking`,

                    descricao:
                        "Ranking de Pontos",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                });

            noticias.push(
                item
            );

            mudancasLiderPontos.push(
                item
            );

        } else if (
            viceDepois?.id ===
            id &&

            viceAntes?.id !==
            id
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "novo_vice_pontos",

                    icone:
                        "🥈",

                    titulo:
                        `${nome} assumiu a vice-liderança do ranking`,

                    descricao:
                        "Agora está em 2º lugar",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                })
            );

            // ========================================
            // SUBIU
            // ========================================

        } else if (
            posDepois > 0 &&

            (
                posAntes ===
                null ||

                posDepois <
                posAntes
            )
        ) {
            const salto =
                posAntes === null
                    ? 0
                    : posAntes -
                    posDepois;


            // ========================================
            // ENTROU NO TOP 3
            // ========================================

            if (
                posDepois <= 3 &&

                (
                    posAntes ===
                    null ||

                    posAntes >
                    3
                )
            ) {
                noticias.push(
                    noticia({
                        tipo:
                            "entrou_top3",

                        icone:
                            "🏅",

                        titulo:
                            `${nome} entrou no Top 3`,

                        descricao:
                            `Assumiu o ${posDepois}º lugar`,

                        usuarioId:
                            id,

                        criadoEm:
                            evento.criadoEm,

                        destaque:
                            true
                    })
                );


                // ========================================
                // ULTRAPASSAGEM NO TOP 3
                // ========================================

            } else if (
                posDepois <= 3 &&

                posAntes !==
                null &&

                posAntes >
                posDepois
            ) {
                const ultrapassado =
                    rankingAntes[
                    posDepois - 1
                    ];


                noticias.push(
                    noticia({
                        tipo:
                            "ultrapassagem",

                        icone:
                            "⚔️",

                        titulo:
                            ultrapassado &&
                                ultrapassado.id !==
                                id
                                ? `${nome} ultrapassou ${ultrapassado.nome}`
                                : `${nome} avançou no Top 3`,

                        descricao:
                            `Assumiu o ${posDepois}º lugar`,

                        usuarioId:
                            id,

                        criadoEm:
                            evento.criadoEm
                    })
                );


                // ========================================
                // SALTO 3+ POSIÇÕES
                // ========================================

            } else if (
                salto >=
                SALTO_MINIMO
            ) {
                noticias.push(
                    noticia({
                        tipo:
                            "salto_ranking",

                        icone:
                            "🚀",

                        titulo:
                            `${nome} subiu ${salto} posições no ranking`,

                        descricao:
                            `Agora está em ${posDepois}º lugar`,

                        usuarioId:
                            id,

                        criadoEm:
                            evento.criadoEm
                    })
                );
            }
        }


        // ========================================
        // MARCOS DE PONTOS
        // 5.000 / 10.000 / 15.000...
        // ========================================

        const marcoAntes =
            Math.floor(
                pontosAntes /
                PASSO_MARCO
            );


        const marcoDepois =
            Math.floor(
                pontosDepois /
                PASSO_MARCO
            );


        if (
            marcoDepois >
            marcoAntes
        ) {
            const marco =
                marcoDepois *
                PASSO_MARCO;


            noticias.push(
                noticia({
                    tipo:
                        "marco_pontos",

                    icone:
                        "🎯",

                    titulo:
                        `${nome} ultrapassou ${pts(
                            marco
                        )} pontos`,

                    descricao:
                        "Ranking de Pontos",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm
                })
            );
        }
    }


    // ========================================
    // MOVIMENTAÇÕES IMPORTANTES
    // NO RANKING DE DIAMANTES
    // ========================================

    const diamantes =
        new Map();

    const atingiuDiamantesEm =
        new Map();


    const eventosDiamante =
        [
            ...eventos
        ]
            .filter(
                evento =>
                    eventoEhDiamante(
                        evento,
                        evento.dados
                    )
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.criadoEm -
                    b.criadoEm ||

                    num(
                        a.id
                    ) -
                    num(
                        b.id
                    )
            );


    // ========================================
    // RANKING ATUAL DOS DIAMANTES
    // ========================================

    function rankingDiamantesAtual() {

        return [
            ...diamantes.entries()
        ]
            .map(
                (
                    [
                        id,
                        quantidade
                    ]
                ) => ({
                    id,

                    nome:
                        nomes.get(
                            id
                        ) ||
                        "Participante",

                    quantidade,

                    atingiuEm:
                        num(
                            atingiuDiamantesEm.get(
                                id
                            )
                        )
                })
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    if (
                        a.quantidade !==
                        b.quantidade
                    ) {
                        return (
                            b.quantidade -
                            a.quantidade
                        );
                    }


                    if (
                        a.atingiuEm !==
                        b.atingiuEm
                    ) {
                        return (
                            a.atingiuEm -
                            b.atingiuEm
                        );
                    }


                    return String(
                        a.id
                    ).localeCompare(
                        String(
                            b.id
                        )
                    );
                }
            );
    }


    // ========================================
    // RECONSTRÓI A DISPUTA
    // DESDE O PRIMEIRO DIAMANTE
    // ========================================

    for (
        const evento
        of eventosDiamante
    ) {
        const id =
            evento.usuarioId;


        const rankingAntes =
            rankingDiamantesAtual();


        const posAntesIndex =
            rankingAntes.findIndex(
                item =>
                    item.id === id
            );


        const posAntes =
            posAntesIndex >= 0
                ? posAntesIndex + 1
                : null;


        const liderAntes =
            rankingAntes[
            0
            ] || null;


        const viceAntes =
            rankingAntes[
            1
            ] || null;


        // ========================================
        // ENTREGA O NOVO DIAMANTE
        // ========================================

        diamantes.set(
            id,

            num(
                diamantes.get(
                    id
                )
            ) + 1
        );


        atingiuDiamantesEm.set(
            id,
            evento.criadoEm
        );


        // ========================================
        // RANKING DEPOIS DO DIAMANTE
        // ========================================

        const rankingDepois =
            rankingDiamantesAtual();


        const posDepoisIndex =
            rankingDepois.findIndex(
                item =>
                    item.id === id
            );


        const posDepois =
            posDepoisIndex >= 0
                ? posDepoisIndex + 1
                : null;


        const liderDepois =
            rankingDepois[
            0
            ] || null;


        const viceDepois =
            rankingDepois[
            1
            ] || null;


        const nome =
            nomes.get(
                id
            ) ||
            "Participante";


        // ========================================
        // NOVO LÍDER
        // ========================================

        if (
            liderDepois?.id ===
            id &&

            liderAntes?.id !==
            id
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "novo_lider_diamantes",

                    icone:
                        "💎👑",

                    titulo:
                        `${nome} assumiu a liderança dos diamantes`,

                    descricao:
                        "Ranking de Diamantes",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                })
            );


            // ========================================
            // NOVO VICE-LÍDER
            // ========================================

        } else if (
            viceDepois?.id ===
            id &&

            viceAntes?.id !==
            id
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "novo_vice_diamantes",

                    icone:
                        "💎🥈",

                    titulo:
                        `${nome} assumiu a vice-liderança dos diamantes`,

                    descricao:
                        "Agora está em 2º lugar",

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                })
            );


            // ========================================
            // ENTROU NO TOP 3
            // ========================================

        } else if (
            posDepois !==
            null &&

            posDepois <=
            3 &&

            (
                posAntes ===
                null ||

                posAntes >
                3
            )
        ) {
            noticias.push(
                noticia({
                    tipo:
                        "top3_diamantes",

                    icone:
                        "💎🏅",

                    titulo:
                        `${nome} entrou no Top 3 dos diamantes`,

                    descricao:
                        `Agora está em ${posDepois}º lugar`,

                    usuarioId:
                        id,

                    criadoEm:
                        evento.criadoEm,

                    destaque:
                        true
                })
            );
        }
    }

    // ========================================
    // HÁ QUANTOS DIAS O LÍDER ATUAL
    // ESTÁ NA LIDERANÇA
    // APENAS PONTOS
    // ========================================
    const estadoAtual =
        new Map();

    const girosAtuais =
        new Map();

    for (
        const u
        of usuarios
    ) {
        const id =
            String(
                u.usuario_id
            );

        estadoAtual.set(
            id,
            {
                id,
                nome:
                    String(
                        u.nome_exibicao ||
                        "Participante"
                    ),

                pontos:
                    Math.max(
                        0,
                        Math.trunc(
                            num(
                                u.pontos
                            )
                        )
                    ),

                atingiuEm:
                    num(
                        u.atingiu_pontuacao_em
                    ) || null,

                criadoEm:
                    num(
                        u.criado_em
                    )
            }
        );

        girosAtuais.set(
            id,
            0
        );
    }

    for (
        const evento
        of eventos
    ) {
        if (
            evento.tipo ===
            "GIRO_ROLETA_PONTOS"
        ) {
            girosAtuais.set(
                evento.usuarioId,

                num(
                    girosAtuais.get(
                        evento.usuarioId
                    )
                ) + 1
            );
        }
    }

    const liderAtual =
        rankingPontos(
            estadoAtual,
            girosAtuais
        )[0] || null;
    if (
        liderAtual
    ) {
        const assumiuEm =
            mudancasLiderPontos
                .filter(
                    item =>
                        item.usuarioId ===
                        liderAtual.id
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.criadoEm -
                        a.criadoEm
                )[0];

        if (
            assumiuEm
        ) {
            const dias =
                Math.floor(
                    (
                        Date.now() -
                        assumiuEm.criadoEm
                    ) /
                    86400000
                );

            if (
                dias >= 1
            ) {
                noticias.push(
                    noticia({
                        tipo:
                            "lideranca_dias",

                        icone:
                            "🔥",

                        titulo:
                            `${liderAtual.nome} está há ${dias} ${dias === 1 ? "dia" : "dias"} na liderança`,

                        descricao:
                            "Ranking de Pontos",

                        usuarioId:
                            liderAtual.id,

                        criadoEm:
                            assumiuEm.criadoEm,

                        destaque:
                            true
                    })
                );
            }
        }
    }

    // ========================================
    // MAIS RECENTE PRIMEIRO
    // ========================================
    const vistas =
        new Set();

    return noticias
        .sort(
            (
                a,
                b
            ) =>
                b.criadoEm -
                a.criadoEm
        )
        .filter(
            item => {

                const chave =
                    `${item.tipo}|${item.usuarioId}|${item.titulo}|${item.criadoEm}`;

                if (
                    vistas.has(
                        chave
                    )
                ) {
                    return false;
                }

                vistas.add(
                    chave
                );
                return true;
            }
        );
}


// ========================================
// API DO SERVICE
// ========================================
function listarNews(
    limite = 500
) {
    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                1000,

                Math.trunc(
                    num(
                        limite
                    ) || 40
                )
            )
        );

    const agora =
        Date.now();

    if (
        cache.noticias.length &&
        agora -
        cache.criadoEm <
        CACHE_MS
    ) {
        return cache.noticias.slice(
            0,
            limiteSeguro
        );
    }

    cache = {
        criadoEm:
            agora,

        noticias:
            gerarNoticias()
    };

    return cache.noticias.slice(
        0,
        limiteSeguro
    );
}

// ========================================
// NEWS DE UM USUÁRIO ESPECÍFICO
// ========================================
function listarNewsUsuario(
    usuarioId,
    limite = 20
) {
    const id =
        String(
            usuarioId || ""
        ).trim();

    if (!id) {
        return {
            total: 0,
            noticias: []
        };
    }

    const limiteSeguro =
        Math.max(
            1,
            Math.min(
                100,

                Math.trunc(
                    num(
                        limite
                    ) || 20
                )
            )
        );

    const agora =
        Date.now();

    if (
        !cache.noticias.length ||
        agora -
        cache.criadoEm >=
        CACHE_MS
    ) {
        cache = {
            criadoEm:
                agora,

            noticias:
                gerarNoticias()
        };
    }

    const noticiasUsuario =
        cache.noticias.filter(
            item =>
                item.usuarioId ===
                id
        );

    return {
        total:
            noticiasUsuario.length,

        noticias:
            noticiasUsuario.slice(
                0,
                limiteSeguro
            )
    };
}

module.exports = {
    listarNews,
    listarNewsUsuario
};