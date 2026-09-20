require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const registrarRotaPerfil = require("./routes/perfil");
const registrarRotaRankingDiamantes =
    require("./routes/ranking-diamantes");
const registrarRotaNews =
    require("./routes/news");

const { Bot } = require("node-telegram-bot-api");

const {
    buscarGiroUsuarioCampanha,
    contarGanhadoresCampanha,
    registrarGiroCampanha,
    zerarRoleta,
    obterEstadoRoleta,
    abrirRoleta,
    salvarUsuarioTelegram,
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
} = require("./database");

const app = express();
app.set("trust proxy", 1);

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;
const GANHADORES_CHAT_ID = process.env.GANHADORES_CHAT_ID;
const CONTROLE_CHAT_ID = process.env.CONTROLE_CHAT_ID;
const ADMIN_ID = process.env.ADMIN_ID;

const CORTE_ID =
    Number(
        process.env.CORTE_ID || 0
    );

if (!BOT_TOKEN) {

    console.log(
        "❌ BOT_TOKEN não configurado"
    );

    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const BOT_INICIADO_EM =
    Math.floor(Date.now() / 1000);


function comandoAntigo(ctx) {

    const dataMensagem =
        Number(
            ctx.message?.date || 0
        );

    if (!dataMensagem) {
        return false;
    }

    return (
        dataMensagem <
        BOT_INICIADO_EM
    );
}

function usuarioLiberadoPorId(
    usuarioId
) {

    const id =
        Number(usuarioId);

    if (
        ADMIN_ID &&
        String(usuarioId) ===
        String(ADMIN_ID)
    ) {
        return true;
    }

    if (
        !CORTE_ID ||
        !Number.isFinite(CORTE_ID)
    ) {
        return true;
    }

    return id <= CORTE_ID;
}

const PORT = process.env.PORT || 3000;

const CAMPANHA_ATUAL =
    "preview_1";

const MAX_GANHADORES = 10;

// ==============================
// PERÍODO DIÁRIO DA ROLETA
// DE PONTOS
// ==============================

const FUSO_HORARIO =
    "America/Sao_Paulo";

const HORA_GIRO_DIARIO = 8;

const MINUTO_GIRO_DIARIO = 30;

function obterPeriodoDiarioAtual(
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

        const diaAnterior =
            new Date(
                Date.UTC(
                    ano,
                    mes - 1,
                    dia - 1
                )
            );

        ano =
            diaAnterior
                .getUTCFullYear();

        mes =
            diaAnterior
                .getUTCMonth() +
            1;

        dia =
            diaAnterior
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

const PREMIOS_DINHEIRO =
    new Set([
        "R$ 50",
        "R$ 12",
        "R$ 10",
        "R$ 5",
        "R$ 7"
    ]);

const CANAIS_OBRIGATORIOS = [
    {
        chatId: "@paradoxopromos",
        nome: "@paradoxopromos",
        url: "https://t.me/paradoxopromos"
    }
];

async function verificarCanaisObrigatorios(usuarioId) {

    const canaisFaltando = [];

    for (const canal of CANAIS_OBRIGATORIOS) {

        const membro =
            await bot.api.getChatMember({
                chat_id: canal.chatId,
                user_id: Number(usuarioId)
            });

        const estaInscrito =
            membro.status === "creator" ||
            membro.status === "administrator" ||
            membro.status === "member" ||
            (
                membro.status === "restricted" &&
                membro.is_member === true
            );

        if (!estaInscrito) {

            canaisFaltando.push({
                nome: canal.nome,
                url: canal.url
            });
        }
    }

    return canaisFaltando;
}

async function avisarGanhador(
    usuario,
    premio
) {

    if (!GANHADORES_CHAT_ID) {
        console.log(
            "⚠️ GANHADORES_CHAT_ID não configurado"
        );
        return;
    }

    const nomeTelegram = (usuario.first_name || "").trim();
    const username = (usuario.username || "").trim();

    let nome;

    if (nomeTelegram.length >= 2) {
        nome = nomeTelegram;
    } else if (username) {
        nome = `@${username}`;
    } else if (nomeTelegram) {
        nome = nomeTelegram;
    } else {
        nome = "Participante";
    }

    try {

        await bot.api.sendMessage({
            chat_id:
                GANHADORES_CHAT_ID,

            text:
                "🎉 NOVO GANHADOR!\n\n" +
                `👤 ${nome}\n` +
                `🏆 Prêmio: ${premio}\n\n` +
                "🎡 Roleta Premiada"
        });

        if (CONTROLE_CHAT_ID) {

            await bot.api.sendMessage({
                chat_id:
                    CONTROLE_CHAT_ID,

                text:
                    "🎯 GANHADOR — CONTROLE\n\n" +
                    `👤 Nome: ${nome}\n` +
                    `🔗 Username: ${username ? `@${username}` : "sem username"}\n` +
                    `🆔 ID: ${usuario.id}\n` +
                    `🏆 Prêmio: ${premio}`
            });
        }

    } catch (erro) {

        console.error(
            "❌ Não consegui avisar o ganhador no grupo:",
            erro
        );
    }
}

function validarInitDataTelegram(initData) {

    if (
        typeof initData !== "string" ||
        !initData
    ) {
        return {
            ok: false,
            motivo: "initData ausente"
        };
    }

    const params =
        new URLSearchParams(initData);

    const hashRecebido =
        params.get("hash");

    if (!hashRecebido) {
        return {
            ok: false,
            motivo: "hash ausente"
        };
    }

    params.delete("hash");

    const dadosOrdenados =
        [...params.entries()]
            .sort(
                ([chaveA], [chaveB]) => {

                    if (chaveA < chaveB) {
                        return -1;
                    }

                    if (chaveA > chaveB) {
                        return 1;
                    }

                    return 0;
                }
            )
            .map(
                ([chave, valor]) =>
                    `${chave}=${valor}`
            )
            .join("\n");

    const chaveSecreta =
        crypto
            .createHmac(
                "sha256",
                "WebAppData"
            )
            .update(BOT_TOKEN)
            .digest();

    const hashCalculado =
        crypto
            .createHmac(
                "sha256",
                chaveSecreta
            )
            .update(dadosOrdenados)
            .digest("hex");

    const hashA =
        Buffer.from(
            hashRecebido,
            "hex"
        );

    const hashB =
        Buffer.from(
            hashCalculado,
            "hex"
        );

    if (
        hashA.length !== hashB.length ||
        !crypto.timingSafeEqual(
            hashA,
            hashB
        )
    ) {
        return {
            ok: false,
            motivo: "assinatura inválida"
        };
    }

    const authDate =
        Number(
            params.get("auth_date")
        );

    const agora =
        Math.floor(
            Date.now() / 1000
        );

    const idade =
        agora - authDate;

    if (
        !Number.isFinite(authDate) ||
        idade < -60 ||
        idade > 3600
    ) {
        return {
            ok: false,
            motivo: "dados expirados"
        };
    }

    let usuario;

    try {

        usuario =
            JSON.parse(
                params.get("user")
            );

    } catch {

        return {
            ok: false,
            motivo: "usuário inválido"
        };
    }

    if (!usuario?.id) {
        return {
            ok: false,
            motivo: "usuário ausente"
        };
    }

    return {
        ok: true,
        usuario
    };
}

// ==============================
// SEGURANÇA
// ==============================

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                scriptSrc: [
                    "'self'",
                    "https://telegram.org"
                ],

                frameAncestors: [
                    "'self'",
                    "https://web.telegram.org",
                    "https://*.telegram.org"
                ]
            }
        }
    })
);

app.use(express.json({
    limit: "10kb"
}));

app.use(express.static("public"));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100
});

app.use(limiter);

registrarRotaPerfil(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
);

registrarRotaRankingDiamantes(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
);

registrarRotaNews(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
);

// ==============================
// PRÊMIOS
// ==============================

const premios = [
    "R$ 50",
    "💎",
    "QUASE",
    "R$ 5",
    "NÃO FOI",
    "💎",
    "R$ 12",
    "QUASE",
    "R$ 7",
    "💎",
    "NÃO DEU",
    "R$ 5",
    "R$ 10",
    "QUASE"
];

// ==============================
// ROLETA DE PONTOS
// ==============================

const resultadosPontosPrimeiroGiro = [
    {
        tipo: "multiplicador",
        multiplicador: 1.5
    },

    {
        tipo: "pontos",
        pontos: 325
    },

    {
        tipo: "diamante",
        pontos: 1000
    },

    {
        tipo: "pontos",
        pontos: 500
    },

    {
        tipo: "pontos",
        pontos: 300
    },

    {
        tipo: "pontos",
        pontos: 700
    },

    {
        tipo: "multiplicador",
        multiplicador: 1.6
    },

    {
        tipo: "pontos",
        pontos: 500
    },

    {
        tipo: "roleta_premiada",
        girosPremiada: 1
    },

    {
        tipo: "pontos",
        pontos: 425
    },

    {
        tipo: "pontos",
        pontos: 700
    },

    {
        tipo: "pontos",
        pontos: 300
    }
];


const resultadosPontosSegundoGiro = [
    {
        tipo: "pontos",
        pontos: 325
    },
    {
        tipo: "diamante",
        pontos: 1000
    },

    {
        tipo: "pontos",
        pontos: 500
    },

    {
        tipo: "pontos",
        pontos: 300
    },

    {
        tipo: "pontos",
        pontos: 700
    },

    {
        tipo: "pontos",
        pontos: 500
    },

    {
        tipo: "roleta_premiada",
        girosPremiada: 1
    },
    {
        tipo: "pontos",
        pontos: 425
    },

    {
        tipo: "pontos",
        pontos: 700
    },

    {
        tipo: "pontos",
        pontos: 300
    }
];


// ==============================
// MULTIPLICADOR DE PONTOS
// ==============================

function aplicarMultiplicadorPontos(
    pontos,
    multiplicador
) {
    const valor =
        Math.max(
            0,
            Math.trunc(
                Number(
                    pontos
                ) || 0
            )
        );

    // 1.5 = 3 / 2
    if (
        multiplicador ===
        1.5
    ) {
        return Math.ceil(
            (
                valor * 3
            ) / 2
        );
    }

    // 1.6 = 8 / 5
    if (
        multiplicador ===
        1.6
    ) {
        return Math.ceil(
            (
                valor * 8
            ) / 5
        );
    }

    return valor;
}

app.post(
    "/api/verificar-acesso",
    (req, res) => {

        const {
            initData
        } = req.body;

        const validacao =
            validarInitDataTelegram(
                initData
            );

        if (!validacao.ok) {

            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }

        const usuario =
            validacao.usuario;

        const permitido =
            usuarioLiberadoPorId(
                usuario.id
            );

        console.log(
            permitido
                ? `✅ ACESSO LIBERADO: ${usuario.id}`
                : `⛔ ACESSO BLOQUEADO PELO ID: ${usuario.id}`
        );

        if (!permitido) {

            return res.status(403).json({
                permitido: false,
                bloqueadoPorId: true
            });
        }


        // ========================================
        // CRIA / ATUALIZA O USUÁRIO DA MINI APP
        // ========================================

        let usuarioApp;

        try {

            usuarioApp =
                salvarUsuarioTelegram(
                    usuario
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao salvar usuário:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar seu usuário agora."
            });
        }


        console.log(
            `👤 USUÁRIO DA MINI APP: ` +
            `${usuarioApp.nome} | ` +
            `ID ${usuarioApp.usuarioId}`
        );


        return res.json({
            permitido: true,

            usuario: {
                nome:
                    usuarioApp.nome,

                pontos:
                    usuarioApp.pontos,

                girosPremiada:
                    usuarioApp.girosPremiada,

                girosPontosExtras:
                    usuarioApp.girosPontosExtras
            }
        });
    }
);

// ==============================
// API DO USUÁRIO
// ==============================

app.post(
    "/api/usuario",
    (req, res) => {

        const {
            initData
        } = req.body;


        const validacao =
            validarInitDataTelegram(
                initData
            );


        if (!validacao.ok) {

            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }


        const usuarioTelegram =
            validacao.usuario;


        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {

            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado: true
            });
        }


        let usuario;

        try {

            usuario =
                salvarUsuarioTelegram(
                    usuarioTelegram
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao carregar usuário:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar seu usuário."
            });
        }

        const periodoDiarioAtual =
            obterPeriodoDiarioAtual();


        const giroDiarioDisponivel =
            usuario.ultimoPeriodoDiario !==
            periodoDiarioAtual;

        const giroExtraDisponivel =
            Number(
                usuario.girosPontosExtras || 0
            ) > 0 &&
            usuario.giroPontosExtraPeriodo ===
            periodoDiarioAtual;

        const podeGirarPontos =
            giroDiarioDisponivel ||
            giroExtraDisponivel;


        const bauUsadoHoje =
            usuario.bauUltimoPeriodo ===
            periodoDiarioAtual;


        const bauDisponivel =
            usuario.ultimoPeriodoDiario ===
            periodoDiarioAtual &&
            !bauUsadoHoje;

        // ========================================
        // ESTADO DA ROLETA PREMIADA
        // ========================================

        const estadoPremiada =
            obterEstadoRoleta();


        const giroNormalAnterior =
            buscarGiroUsuarioCampanha(
                String(
                    usuario.usuarioId
                ),
                CAMPANHA_ATUAL
            );


        const premiosNormaisEsgotados =
            contarGanhadoresCampanha(
                CAMPANHA_ATUAL
            ) >= MAX_GANHADORES;


        const agora =
            Date.now();


        const chancePremiadaDisponivel =
            Number(
                usuario.girosPremiada || 0
            ) >= 1 &&
            Number(
                usuario.giroPremiadaExpiraEm || 0
            ) > agora;


        const giroNormalDisponivel =
            estadoPremiada.aberta === true &&
            !giroNormalAnterior &&
            !premiosNormaisEsgotados;


        const podeGirarPremiada =
            giroNormalDisponivel ||
            chancePremiadaDisponivel;

        const configuracaoPremiada =
            obterConfiguracaoPremiadaBonus();

        return res.json({

            usuario: {

                id:
                    usuario.usuarioId,

                nome:
                    usuario.nome,

                firstName:
                    usuario.firstName,

                lastName:
                    usuario.lastName,

                username:
                    usuario.username,

                pontos:
                    usuario.pontos,

                girosPremiada:
                    usuario.girosPremiada,

                giroPremiadaExpiraEm:
                    usuario.giroPremiadaExpiraEm,

                roletaPremiada: {

                    versao:
                        estadoPremiada.versao,

                    rodadaAberta:
                        estadoPremiada.aberta,

                    giroNormalUtilizado:
                        Boolean(
                            giroNormalAnterior
                        ),

                    giroNormalDisponivel,

                    chancePremiadaDisponivel,

                    chancePremiadaExpiraEm:
                        chancePremiadaDisponivel
                            ? usuario.giroPremiadaExpiraEm
                            : null,

                    premiosNormaisEsgotados,

                    podeGirar:
                        podeGirarPremiada,

                    itens:
                        configuracaoPremiada.itens
                },

                girosPontosExtras:
                    giroExtraDisponivel
                        ? usuario.girosPontosExtras
                        : 0,

                giroExtraDisponivel:
                    giroExtraDisponivel,

                podeGirarPontos:
                    podeGirarPontos,

                ultimoPeriodoDiario:
                    usuario.ultimoPeriodoDiario,

                periodoDiarioAtual:
                    periodoDiarioAtual,

                giroDiarioDisponivel:
                    giroDiarioDisponivel,

                bauSegundaChance: {
                    disponivel:
                        bauDisponivel,

                    usadoHoje:
                        bauUsadoHoje,

                    precisaGirar:
                        usuario.ultimoPeriodoDiario !==
                        periodoDiarioAtual
                },

                dados:
                    usuario.dados
            }
        });
    }
);

// ==============================
// GIRO DA ROLETA DE PONTOS
// ==============================

app.post(
    "/api/girar-pontos",
    (req, res) => {

        const {
            initData
        } = req.body;


        const validacao =
            validarInitDataTelegram(
                initData
            );


        if (!validacao.ok) {

            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }


        const usuarioTelegram =
            validacao.usuario;


        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {

            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado: true
            });
        }


        let usuario;

        try {

            usuario =
                salvarUsuarioTelegram(
                    usuarioTelegram
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao carregar usuário:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar seu usuário."
            });
        }


        const periodoDiario =
            obterPeriodoDiarioAtual();


        // ========================================
        // JÁ GIROU NESTE PERÍODO?
        // ========================================

        const giroDiarioDisponivel =
            usuario.ultimoPeriodoDiario !==
            periodoDiario;


        const giroExtraDisponivel =
            Number(
                usuario.girosPontosExtras || 0
            ) > 0 &&
            usuario.giroPontosExtraPeriodo ===
            periodoDiario;

        if (
            !giroDiarioDisponivel &&
            !giroExtraDisponivel
        ) {
            return res.status(409).json({
                erro:
                    "Você não possui giros disponíveis agora.",

                semGirosPontos:
                    true,

                periodoDiario
            });
        }

        const tipoGiro =
            giroDiarioDisponivel
                ? "diario"
                : "extra";


        // ========================================
        // PRIMEIRO GIRO
        // ========================================

        const indice =
            crypto.randomInt(
                0,
                resultadosPontosPrimeiroGiro
                    .length
            );


        const resultadoPrimeiroGiro =
            resultadosPontosPrimeiroGiro[
            indice
            ];


        // ========================================
        // VERIFICA MULTIPLICADOR
        // ========================================

        let teveMultiplicador =
            false;


        let multiplicador =
            null;


        let indiceSegundoGiro =
            null;


        let resultadoSegundoGiro =
            null;


        let resultadoFinal =
            resultadoPrimeiroGiro;


        if (
            resultadoPrimeiroGiro.tipo ===
            "multiplicador"
        ) {

            teveMultiplicador =
                true;


            multiplicador =
                Number(
                    resultadoPrimeiroGiro
                        .multiplicador
                );

            // ========================================
            // SEGUNDO GIRO
            // ESTA LISTA NÃO POSSUI
            // 1.5x NEM 1.6x.
            // ========================================

            indiceSegundoGiro =
                crypto.randomInt(
                    0,
                    resultadosPontosSegundoGiro
                        .length
                );


            resultadoSegundoGiro =
                resultadosPontosSegundoGiro[
                indiceSegundoGiro
                ];


            resultadoFinal =
                resultadoSegundoGiro;
        }


        // ========================================
        // RESULTADO FINAL
        // ========================================

        const tipoResultado =
            resultadoFinal.tipo;


        const pontosBase =
            Number(
                resultadoFinal.pontos ||
                0
            );


        let pontosGanhos =
            pontosBase;


        const girosPremiadaGanhos =
            Number(
                resultadoFinal
                    .girosPremiada ||
                0
            );


        // ========================================
        // MULTIPLICADOR SOMENTE EM PONTOS
        //
        // ROLETINHA PREMIADA NÃO MULTIPLICA.
        // ========================================

        if (
            teveMultiplicador &&
            pontosBase > 0
        ) {

            pontosGanhos =
                aplicarMultiplicadorPontos(
                    pontosBase,
                    multiplicador
                );
        }


        // ========================================
        // REGISTRO ATÔMICO
        // ========================================

        let registro;

        try {

            const dadosRegistro = {
                usuarioId:
                    usuario.usuarioId,

                periodoDiario,

                indice,

                tipoResultado,

                pontosGanhos,

                girosPremiadaGanhos,

                teveMultiplicador,

                multiplicador,

                indiceSegundoGiro,

                tipoPrimeiroGiro:
                    resultadoPrimeiroGiro.tipo,

                tipoSegundoGiro:
                    resultadoSegundoGiro
                        ? resultadoSegundoGiro.tipo
                        : null,

                pontosBase
            };


            registro =
                tipoGiro === "diario"
                    ? registrarGiroPontosDiario(
                        dadosRegistro
                    )
                    : registrarGiroPontosExtra(
                        dadosRegistro
                    );

        } catch (erro) {

            console.error(
                "❌ Erro ao registrar giro de pontos:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível registrar seu giro."
            });
        }


        if (!registro.ok) {

            if (
                registro.motivo ===
                "giro_diario_ja_usado"
            ) {

                return res.status(409).json({
                    erro:
                        "Você já utilizou seu giro diário.",

                    jaGirouHoje:
                        true,

                    periodoDiario
                });
            }


            return res.status(500).json({
                erro:
                    "Não foi possível concluir seu giro."
            });
        }


        if (
            teveMultiplicador
        ) {

            console.log(
                `🎯 ROLETA DE PONTOS | ` +
                `${usuario.usuarioId} | ` +
                `1º índice ${indice} | ` +
                `${multiplicador}x | ` +
                `2º índice ${indiceSegundoGiro} | ` +
                `${tipoResultado} | ` +
                `base ${pontosBase} | ` +
                `final +${pontosGanhos} pts | ` +
                `+${girosPremiadaGanhos} giro premiada`
            );

        } else {

            console.log(
                `🎯 ROLETA DE PONTOS | ` +
                `${usuario.usuarioId} | ` +
                `índice ${indice} | ` +
                `${tipoResultado} | ` +
                `+${pontosGanhos} pts | ` +
                `+${girosPremiadaGanhos} giro premiada`
            );
        }


        return res.json({

            indice,
            tipo: tipoResultado,
            tipoFinal: tipoResultado,
            pontosGanhos,
            pontosBase,
            girosPremiadaGanhos,
            periodoDiario,
            teveMultiplicador,
            multiplicador,
            indiceSegundoGiro,
            tipoGiro,

            bauLiberado:
                tipoGiro === "diario",
            usuario: {

                pontos:
                    registro.usuario.pontos,

                girosPremiada:
                    registro.usuario.girosPremiada,

                giroPremiadaExpiraEm:
                    registro.usuario.giroPremiadaExpiraEm,

                girosPontosExtras:
                    registro.usuario.girosPontosExtras,

                ultimoPeriodoDiario:
                    registro.usuario.ultimoPeriodoDiario
            }
        });
    }
);

// ==============================
// BAÚ DA SEGUNDA CHANCE
// ==============================

app.post(
    "/api/abrir-bau",
    (req, res) => {

        const {
            initData,
            indiceBau
        } = req.body;

        const validacao =
            validarInitDataTelegram(
                initData
            );

        if (!validacao.ok) {

            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }
        const usuarioTelegram =
            validacao.usuario;

        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {
            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado:
                    true
            });
        }

        const indiceEscolhido =
            Math.trunc(
                Number(
                    indiceBau
                )
            );


        if (
            !Number.isInteger(
                indiceEscolhido
            ) ||
            indiceEscolhido < 0 ||
            indiceEscolhido > 2
        ) {

            return res.status(400).json({
                erro:
                    "Baú inválido."
            });
        }


        const usuario =
            salvarUsuarioTelegram(
                usuarioTelegram
            );


        const periodoDiario =
            obterPeriodoDiarioAtual();


        const indiceBauPontos =
            crypto.randomInt(
                0,
                3
            );


        const pontosSorteados =
            crypto.randomInt(
                200,
                401
            );


        const registro =
            registrarBauSegundaChance({
                usuarioId:
                    usuario.usuarioId,

                periodoDiario,

                indiceEscolhido,

                indiceBauPontos,

                pontosSorteados
            });


        if (!registro.ok) {

            if (
                registro.motivo ===
                "giro_diario_necessario"
            ) {

                return res.status(409).json({
                    erro:
                        "Gire a Roleta de Pontos primeiro."
                });
            }


            return res.status(409).json({
                erro:
                    "Você já abriu seu baú deste período."
            });
        }


        console.log(
            `🎁 BAÚ | ` +
            `${usuario.usuarioId} | ` +
            `${registro.tipoPremio} | ` +
            `+${registro.pontosGanhos} pts | ` +
            `+${registro.girosPontosExtrasGanhos} giro extra`
        );


        return res.json({
            periodoDiario,

            indiceEscolhido,

            indiceBauPontos,

            pontosSorteados,

            tipoPremio:
                registro.tipoPremio,

            pontosGanhos:
                registro.pontosGanhos,

            girosPontosExtrasGanhos:
                registro.girosPontosExtrasGanhos,

            usuario: {
                pontos:
                    registro.usuario.pontos,

                girosPontosExtras:
                    registro.usuario.girosPontosExtras
            }
        });
    }
);

// ==============================
// RANKING DE PONTOS
// ==============================

app.post(
    "/api/ranking",
    (req, res) => {
        const {
            initData
        } = req.body;


        const validacao =
            validarInitDataTelegram(
                initData
            );

        if (!validacao.ok) {
            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }

        const usuarioTelegram =
            validacao.usuario;

        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {
            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado: true
            });
        }

        try {
            // Atualiza nome / username,
            // sem alterar pontos ou chances.

            salvarUsuarioTelegram(
                usuarioTelegram
            );

            const ranking =
                listarRankingPontos(
                    40
                );

            const minhaPosicao =
                obterPosicaoRankingPontos(
                    usuarioTelegram.id
                );

            return res.json({

                ranking:
                    ranking.map(
                        item => ({
                            usuarioId:
                                String(
                                    item.usuario_id
                                ),

                            posicao:
                                Number(
                                    item.posicao
                                ),

                            posicaoAnterior:
                                item.posicao_anterior ===
                                    null ||
                                    item.posicao_anterior ===
                                    undefined

                                    ? null

                                    : Number(
                                        item.posicao_anterior
                                    ),

                            movimento:
                                item.movimento ||
                                "manteve",

                            nome:
                                item.nome_exibicao,

                            username:
                                item.username,

                            pontos:
                                Number(
                                    item.pontos || 0
                                )
                        })
                    ),

                usuario:
                    minhaPosicao
                        ? {
                            usuarioId:
                                String(
                                    minhaPosicao.usuario_id
                                ),
                            posicao:
                                Number(
                                    minhaPosicao.posicao
                                ),

                            nome:
                                minhaPosicao.nome_exibicao,

                            username:
                                minhaPosicao.username,

                            pontos:
                                Number(
                                    minhaPosicao.pontos || 0
                                )
                        }
                        : null
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao carregar ranking:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar o ranking agora."
            });
        }
    }
);

// ==============================
// HISTÓRICO DA ROLETA PREMIADA
// ==============================

app.post(
    "/api/historico-premiada",
    (req, res) => {
        const {
            initData
        } = req.body;

        const validacao =
            validarInitDataTelegram(
                initData
            );


        if (!validacao.ok) {
            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }

        const usuarioTelegram =
            validacao.usuario;

        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {
            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado:
                    true
            });
        }

        try {
            const ganhadores =
                listarGanhadoresPremiada();

            res.set(
                "Cache-Control",
                "no-store"
            );

            return res.json({
                ganhadores
            });

        } catch (erro) {
            console.error(
                "❌ Erro ao carregar histórico da premiada:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar os vencedores."
            });
        }
    }
);

// ==============================
// HISTÓRICO DA ROLETA DE PONTOS
// ==============================

app.post(
    "/api/historico-pontos",
    (req, res) => {
        const {
            initData
        } = req.body;

        const validacao =
            validarInitDataTelegram(
                initData
            );

        if (!validacao.ok) {
            return res.status(401).json({
                erro:
                    "Abra pelo Telegram."
            });
        }

        const usuarioTelegram =
            validacao.usuario;

        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {
            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada.",
                acessoBloqueado:
                    true
            });
        }

        try {
            const resultados =
                listarUltimosResultadosPontos(
                    20
                );

            res.set(
                "Cache-Control",
                "no-store"
            );

            return res.json({
                resultados
            });

        } catch (erro) {

            console.error(
                "❌ Erro ao carregar histórico de pontos:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar os últimos resultados."
            });
        }
    }
);

app.get(
    "/api/estado-roleta",
    (req, res) => {

        res.set(
            "Cache-Control",
            "no-store"
        );

        const estado =
            obterEstadoRoleta();

        return res.json({
            versao:
                estado.versao,

            aberta:
                estado.aberta
        });
    }
);

// ==============================
// API DA ROLETA
// ==============================

app.post(
    "/api/verificar-comunidade",
    async (req, res) => {

        const {
            initData
        } = req.body;

        const validacao =
            validarInitDataTelegram(
                initData
            );

        if (!validacao.ok) {

            return res.status(401).json({
                erro:
                    "Abra a roleta pelo Telegram."
            });
        }

        const usuario =
            validacao.usuario;

        try {

            const canaisFaltando =
                await verificarCanaisObrigatorios(
                    usuario.id
                );

            return res.json({
                inscrito:
                    canaisFaltando.length === 0,

                canaisFaltando
            });

        } catch (erro) {

            console.error(
                "❌ Erro ao verificar comunidade:",
                erro
            );

            return res.status(503).json({
                erro:
                    "Não foi possível verificar sua inscrição agora. Tente novamente."
            });
        }
    }
);

app.post(
    "/api/girar",
    async (req, res) => {

        const {
            initData,
            versaoRodada
        } = req.body;


        const validacao =
            validarInitDataTelegram(
                initData
            );


        if (!validacao.ok) {

            console.log(
                "⛔ Giro bloqueado:",
                validacao.motivo
            );

            return res.status(401).json({
                erro:
                    "Abra a roleta pelo Telegram."
            });
        }


        const usuarioTelegram =
            validacao.usuario;


        if (
            !usuarioLiberadoPorId(
                usuarioTelegram.id
            )
        ) {

            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada para participar.",

                acessoBloqueado:
                    true
            });
        }


        let usuarioApp;

        try {

            usuarioApp =
                salvarUsuarioTelegram(
                    usuarioTelegram
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao carregar usuário:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível carregar seu usuário."
            });
        }


        const usuarioId =
            String(
                usuarioTelegram.id
            );


        // ========================================
        // ESTADO INICIAL
        // ========================================

        const estadoInicial =
            obterEstadoRoleta();


        if (
            Number(versaoRodada) !==
            estadoInicial.versao
        ) {

            return res.status(409).json({
                erro:
                    "Uma nova rodada foi iniciada.",

                rodadaAtualizada:
                    true,

                versao:
                    estadoInicial.versao
            });
        }


        const giroNormalAnterior =
            buscarGiroUsuarioCampanha(
                usuarioId,
                CAMPANHA_ATUAL
            );


        const agoraInicial =
            Date.now();


        const chanceBonusInicial =
            Number(
                usuarioApp.girosPremiada ||
                0
            ) >= 1 &&
            Number(
                usuarioApp
                    .giroPremiadaExpiraEm ||
                0
            ) > agoraInicial;


        const normalInicialDisponivel =
            estadoInicial.aberta === true &&
            !giroNormalAnterior;


        if (
            !normalInicialDisponivel &&
            !chanceBonusInicial
        ) {

            if (
                !estadoInicial.aberta
            ) {

                return res.status(423).json({
                    erro:
                        "A nova rodada ainda não foi liberada.",

                    rodadaFechada:
                        true,

                    versao:
                        estadoInicial.versao
                });
            }


            return res.status(409).json({
                erro:
                    "Você não possui chances disponíveis.",

                chanceEsgotada:
                    true,

                jaGirou:
                    true
            });
        }


        const versaoDoGiro =
            estadoInicial.versao;


        // ========================================
        // COMUNIDADE
        // ========================================

        try {

            const canaisFaltando =
                await verificarCanaisObrigatorios(
                    usuarioTelegram.id
                );


            if (
                canaisFaltando.length >
                0
            ) {

                return res.status(403).json({
                    erro:
                        "Você precisa estar inscrito nos canais obrigatórios.",

                    canaisFaltando
                });
            }

        } catch (erro) {

            console.error(
                "❌ Erro ao consultar canais:",
                erro
            );

            return res.status(503).json({
                erro:
                    "Não foi possível verificar sua inscrição agora. Tente novamente."
            });
        }


        // ========================================
        // CONFIRMA ESTADO APÓS O AWAIT
        // ========================================

        const estadoConfirmado =
            obterEstadoRoleta();


        if (
            estadoConfirmado.versao !==
            versaoDoGiro
        ) {

            return res.status(409).json({
                erro:
                    "Uma nova rodada foi iniciada.",

                rodadaAtualizada:
                    true,

                versao:
                    estadoConfirmado.versao
            });
        }


        let usuarioConfirmado;

        try {

            usuarioConfirmado =
                salvarUsuarioTelegram(
                    usuarioTelegram
                );

        } catch (erro) {

            console.error(
                "❌ Erro ao confirmar usuário:",
                erro
            );

            return res.status(500).json({
                erro:
                    "Não foi possível confirmar sua participação."
            });
        }


        const giroNormalConfirmado =
            buscarGiroUsuarioCampanha(
                usuarioId,
                CAMPANHA_ATUAL
            );


        const agoraConfirmado =
            Date.now();


        let chanceBonusDisponivel =
            Number(
                usuarioConfirmado
                    .girosPremiada ||
                0
            ) >= 1 &&
            Number(
                usuarioConfirmado
                    .giroPremiadaExpiraEm ||
                0
            ) > agoraConfirmado;


        let normalDisponivel =
            estadoConfirmado.aberta ===
            true &&
            !giroNormalConfirmado;


        if (
            !normalDisponivel &&
            !chanceBonusDisponivel
        ) {

            if (
                !estadoConfirmado.aberta
            ) {

                return res.status(423).json({
                    erro:
                        "A nova rodada ainda não foi liberada.",

                    rodadaFechada:
                        true,

                    versao:
                        estadoConfirmado.versao
                });
            }


            return res.status(409).json({
                erro:
                    "Você não possui chances disponíveis.",

                chanceEsgotada:
                    true,

                jaGirou:
                    true
            });
        }


        // ========================================
        // ESCOLHE A ORIGEM
        //
        // NORMAL TEM PRIORIDADE ABSOLUTA
        // ========================================

        let origemGiro;


        if (normalDisponivel) {

            const totalGanhadores =
                contarGanhadoresCampanha(
                    CAMPANHA_ATUAL
                );


            if (
                totalGanhadores <
                MAX_GANHADORES
            ) {

                origemGiro =
                    "normal";

            } else if (
                chanceBonusDisponivel
            ) {

                origemGiro =
                    "bonus";

            } else {

                return res.status(410).json({
                    erro:
                        "Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀",

                    premiosEsgotados:
                        true
                });
            }

        } else {

            origemGiro =
                "bonus";
        }


        // ========================================
        // VARIÁVEIS DO RESULTADO
        // ========================================

        let indice;

        let premio;

        let tipoResultado;

        let pontosGanhos = 0;

        let ehPremio = false;

        let itensGiro = null;

        let itensDepois = null;

        let registro;


        // ========================================
        // GIRO NORMAL
        // ========================================

        if (
            origemGiro ===
            "normal"
        ) {

            const configuracao =
                obterConfiguracaoPremiadaBonus();


            indice =
                crypto.randomInt(
                    0,
                    configuracao
                        .fatias
                        .length
                );


            const fatia =
                configuracao
                    .fatias[
                indice
                ];


            premio =
                fatia.premio;


            tipoResultado =
                fatia.tipo;


            pontosGanhos =
                Number(
                    fatia.pontos ||
                    0
                );


            ehPremio =
                PREMIOS_DINHEIRO.has(
                    premio
                );


            itensGiro =
                configuracao.itens;


            itensDepois =
                configuracao.itens;


            registro =
                registrarGiroCampanha({
                    usuarioId,

                    indice,

                    premio,

                    campanha:
                        CAMPANHA_ATUAL,

                    ehPremio,

                    maxGanhadores:
                        MAX_GANHADORES,

                    tipoResultado,

                    pontosGanhos
                });


            // ========================================
            // RACE:
            // NORMAL SUMIU.
            //
            // SE AINDA HOUVER BÔNUS,
            // USA A CHANCE PESSOAL.
            // ========================================

            if (!registro.ok) {

                if (
                    registro.motivo ===
                    "ja_girou" ||
                    registro.motivo ===
                    "esgotado"
                ) {

                    const usuarioBonus =
                        salvarUsuarioTelegram(
                            usuarioTelegram
                        );


                    const agoraBonus =
                        Date.now();


                    chanceBonusDisponivel =
                        Number(
                            usuarioBonus
                                .girosPremiada ||
                            0
                        ) >= 1 &&
                        Number(
                            usuarioBonus
                                .giroPremiadaExpiraEm ||
                            0
                        ) > agoraBonus;


                    if (
                        chanceBonusDisponivel
                    ) {

                        origemGiro =
                            "bonus";


                        registro =
                            registrarGiroPremiadaBonus({
                                usuarioId,
                                indice
                            });


                        if (registro.ok) {

                            premio =
                                registro.premio;

                            tipoResultado =
                                registro
                                    .tipoResultado;

                            pontosGanhos =
                                Number(
                                    registro
                                        .pontosGanhos ||
                                    0
                                );

                            ehPremio =
                                registro
                                    .ehPremio ===
                                true;

                            itensGiro =
                                registro
                                    .itensGiro;

                            itensDepois =
                                registro
                                    .itensDepois;
                        }

                    } else if (
                        registro.motivo ===
                        "esgotado"
                    ) {

                        return res.status(410).json({
                            erro:
                                "Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀",

                            premiosEsgotados:
                                true
                        });

                    } else {

                        return res.status(409).json({
                            erro:
                                "Você não possui chances disponíveis.",

                            chanceEsgotada:
                                true,

                            jaGirou:
                                true
                        });
                    }
                }
            }


        } else {

            // ========================================
            // GIRO BÔNUS
            // ========================================

            const configuracao =
                obterConfiguracaoPremiadaBonus();


            indice =
                crypto.randomInt(
                    0,
                    configuracao
                        .fatias
                        .length
                );


            registro =
                registrarGiroPremiadaBonus({
                    usuarioId,
                    indice
                });


            if (registro.ok) {

                premio =
                    registro.premio;

                tipoResultado =
                    registro
                        .tipoResultado;

                pontosGanhos =
                    Number(
                        registro
                            .pontosGanhos ||
                        0
                    );

                ehPremio =
                    registro.ehPremio ===
                    true;

                itensGiro =
                    registro.itensGiro;

                itensDepois =
                    registro.itensDepois;
            }
        }


        // ========================================
        // BÔNUS SUMIU / EXPIROU
        // ========================================

        if (
            !registro ||
            !registro.ok
        ) {

            return res.status(409).json({
                erro:
                    "Sua chance conquistada não está mais disponível.",

                chanceEsgotada:
                    true
            });
        }


        const usuarioFinal =
            salvarUsuarioTelegram(
                usuarioTelegram
            );


        const giroId =
            origemGiro ===
                "normal"
                ? registro.giroId
                : registro.eventoId;


        console.log(
            `🎡 ROLETA PREMIADA | ` +
            `${usuarioId} | ` +
            `${origemGiro.toUpperCase()} | ` +
            `${premio} | ` +
            `+${pontosGanhos} pts`
        );


        // ========================================
        // AVISO DE GANHADOR
        //
        // SOMENTE DINHEIRO.
        // DIAMANTE NÃO VAI PARA
        // LISTA DE GANHADORES EM R$.
        // ========================================

        if (ehPremio) {

            setTimeout(
                () => {

                    if (
                        origemGiro ===
                        "normal"
                    ) {

                        const estadoAtual =
                            obterEstadoRoleta();


                        if (
                            estadoAtual.versao !==
                            versaoDoGiro
                        ) {

                            console.log(
                                "⏭️ Aviso antigo da rodada normal ignorado"
                            );

                            return;
                        }
                    }


                    avisarGanhador(
                        usuarioTelegram,
                        premio
                    ).catch(
                        (erro) => {

                            console.error(
                                "❌ Erro ao anunciar ganhador:",
                                erro
                            );
                        }
                    );

                },
                5500
            );
        }


        return res.json({

            giroId,

            indice,

            premio,

            tipoResultado,

            pontosGanhos,

            origem:
                origemGiro,

            itensGiro,

            itensDepois,

            usuario: {

                pontos:
                    usuarioFinal.pontos,

                girosPremiada:
                    usuarioFinal
                        .girosPremiada,

                giroPremiadaExpiraEm:
                    usuarioFinal
                        .giroPremiadaExpiraEm
            }
        });
    }
);

// ==============================
// TELEGRAM
// ==============================

bot.command("roleta", async (ctx) => {

    if (comandoAntigo(ctx)) {

        console.log(
            "⏭️ /roleta antigo ignorado"
        );

        return;
    }

    const usuarioId =
        String(ctx.from?.id || "");

    if (
        !ADMIN_ID ||
        usuarioId !== String(ADMIN_ID)
    ) {
        await bot.api.sendMessage({
            chat_id: ctx.chat.id,
            text: "⛔ Comando não autorizado."
        });

        return;
    }

    try {

        const resumo =
            zerarRoleta();

        console.log(
            `🎡 ROLETA ZERADA pelo admin. ` +
            `${resumo.girosRemovidos} giros removidos. ` +
            `${resumo.ganhadoresRemovidos} ganhadores removidos.`
        );

        await bot.api.sendMessage({
            chat_id: ctx.chat.id,

            text:
                "✅ NOVA RODADA PREPARADA!\n\n" +
                `🗑 ${resumo.girosRemovidos} giros removidos.\n` +
                `🏆 Ganhadores da rodada anterior: ${resumo.ganhadoresRemovidos}/${MAX_GANHADORES}\n` +
                `🔢 Nova rodada: ${resumo.versao}\n\n` +
                "🔒 A nova rodada está FECHADA.\n" +
                "📢 Envie /abrir quando quiser liberar."
        });

    } catch (erro) {

        console.error(
            "❌ Erro ao zerar roleta:",
            erro
        );

        await bot.api.sendMessage({
            chat_id: ctx.chat.id,
            text:
                "❌ Não foi possível zerar a roleta."
        });
    }
});

bot.command("abrir", async (ctx) => {

    if (comandoAntigo(ctx)) {

        console.log(
            "⏭️ /abrir antigo ignorado"
        );

        return;
    }

    const usuarioId =
        String(ctx.from?.id || "");

    if (
        !ADMIN_ID ||
        usuarioId !==
        String(ADMIN_ID)
    ) {

        await bot.api.sendMessage({
            chat_id:
                ctx.chat.id,

            text:
                "⛔ Comando não autorizado."
        });

        return;
    }

    try {

        const estadoAntes =
            obterEstadoRoleta();

        if (estadoAntes.aberta) {

            await bot.api.sendMessage({
                chat_id:
                    ctx.chat.id,

                text:
                    `⚠️ A rodada ${estadoAntes.versao} já está aberta.`
            });

            return;
        }

        const estado =
            abrirRoleta();

        console.log(
            `🎡 RODADA ${estado.versao} LIBERADA`
        );

        await bot.api.sendMessage({
            chat_id:
                ctx.chat.id,

            text:
                "🎡 RODADA LIBERADA!\n\n" +
                `🔢 Rodada: ${estado.versao}\n` +
                `🏆 Limite: ${MAX_GANHADORES} ganhadores\n\n` +
                "✅ Participações liberadas."
        });

    } catch (erro) {

        console.error(
            "❌ Erro ao abrir roleta:",
            erro
        );

        await bot.api.sendMessage({
            chat_id:
                ctx.chat.id,

            text:
                "❌ Não foi possível abrir a rodada."
        });
    }
});

bot.command(
    "start",
    async (ctx) => {

        if (comandoAntigo(ctx)) {

            console.log(
                "⏭️ /start antigo ignorado"
            );

            return;
        }

        await ctx.reply(
            "🎁 Aobaa Bem-vindo(a) !\n\nToque abaixo para jogar:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🎮 ABRIR MENU",
                                web_app: {
                                    url: MINI_APP_URL
                                }
                            }
                        ]
                    ]
                }
            }
        );
    }
);

bot.command(
    "teste",
    async (ctx) => {

        if (comandoAntigo(ctx)) {

            console.log(
                "⏭️ /teste antigo ignorado"
            );

            return;
        }

        try {

            const eu =
                await bot.api.getMe();

            console.log(
                `🤖 Bot em uso: @${eu.username} | ID: ${eu.id}`
            );

            const statusBot =
                await bot.api.getChatMember({
                    chat_id: "@paradoxopromos",
                    user_id: eu.id
                });

            console.log(
                "📢 Status do bot no canal:",
                statusBot.status
            );

            const statusUsuario =
                await bot.api.getChatMember({
                    chat_id: "@paradoxopromos",
                    user_id: ctx.from.id
                });

            console.log(
                "👤 Status do usuário no canal:",
                statusUsuario.status
            );

            await ctx.reply(
                `Bot: @${eu.username}\n` +
                `Status do bot: ${statusBot.status}\n` +
                `Seu status: ${statusUsuario.status}`
            );

        } catch (erro) {

            console.error(
                "❌ TESTE DO CANAL:",
                erro
            );

            await ctx.reply(
                "❌ Deu erro no teste. Veja o terminal."
            );
        }
    }
);

bot.startPolling()
    .catch((erro) => {

        console.error(
            "❌ Erro no Telegram:",
            erro
        );
    });

console.log(
    "🤖 BOT TELEGRAM INICIADO"
);


// ==============================
// SERVIDOR
// ==============================

app.listen(
    PORT,
    () => {

        console.log(
            "🎡 ROLETA INICIADA"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );
    }
);