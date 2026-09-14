require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const { Bot } = require("node-telegram-bot-api");

const {
    buscarGiroUsuarioCampanha,
    contarGanhadoresCampanha,
    registrarGiroCampanha,
    zerarRoleta,
    obterEstadoRoleta,
    abrirRoleta,
    salvarUsuarioTelegram,
    registrarGiroPontosDiario
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

const PREMIOS_VALIDOS =
    new Set([
        "R$ 5",
        "R$ 10",
        "R$ 6",
        "R$ 9",
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


// ==============================
// PRÊMIOS
// ==============================

const premios = [
    "QUASE",
    "R$ 5",
    "NÃO",
    "R$ 10",
    "QUASE",
    "R$ 6",
    "R$ 9",
    "TRAVEE",
    "PRA FORA",
    "R$ 7"
];

// ==============================
// ROLETA DE PONTOS
// ==============================

const resultadosPontos = [
    {
        tipo: "pontos",
        pontos: 100
    },
    {
        tipo: "pontos",
        pontos: 500
    },
    {
        tipo: "diamante",
        pontos: 1000
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
        pontos: 100
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
        pontos: 100
    },
    {
        tipo: "pontos",
        pontos: 700
    },
    {
        tipo: "pontos",
        pontos: 300
    },
    {
        tipo: "pontos",
        pontos: 100
    }
];

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

                girosPontosExtras:
                    usuario.girosPontosExtras,

                ultimoPeriodoDiario:
                    usuario.ultimoPeriodoDiario,

                periodoDiarioAtual:
                    periodoDiarioAtual,

                giroDiarioDisponivel:
                    giroDiarioDisponivel,

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

        if (
            usuario.ultimoPeriodoDiario ===
            periodoDiario
        ) {

            return res.status(409).json({
                erro:
                    "Você já utilizou seu giro diário.",

                jaGirouHoje:
                    true,

                periodoDiario
            });
        }


        // ========================================
        // SORTEIO FEITO NO SERVIDOR
        // ========================================

        const indice =
            crypto.randomInt(
                0,
                resultadosPontos.length
            );


        const resultado =
            resultadosPontos[
            indice
            ];


        const pontosGanhos =
            Number(
                resultado.pontos || 0
            );


        const girosPremiadaGanhos =
            Number(
                resultado.girosPremiada || 0
            );


        // ========================================
        // REGISTRO ATÔMICO
        // ========================================

        let registro;

        try {

            registro =
                registrarGiroPontosDiario({
                    usuarioId:
                        usuario.usuarioId,

                    periodoDiario,

                    indice,

                    tipoResultado:
                        resultado.tipo,

                    pontosGanhos,

                    girosPremiadaGanhos
                });

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


        console.log(
            `🎯 ROLETA DE PONTOS | ` +
            `${usuario.usuarioId} | ` +
            `índice ${indice} | ` +
            `${resultado.tipo} | ` +
            `+${pontosGanhos} pts | ` +
            `+${girosPremiadaGanhos} giro premiada`
        );


        return res.json({

            indice,

            tipo:
                resultado.tipo,

            pontosGanhos,

            girosPremiadaGanhos,

            periodoDiario,

            usuario: {

                pontos:
                    registro.usuario.pontos,

                girosPremiada:
                    registro.usuario.girosPremiada,

                girosPontosExtras:
                    registro.usuario.girosPontosExtras,

                ultimoPeriodoDiario:
                    registro.usuario.ultimoPeriodoDiario
            }
        });
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

        const usuario = validacao.usuario;

        if (
            !usuarioLiberadoPorId(
                usuario.id
            )
        ) {
            console.log(
                `⛔ Giro bloqueado pelo corte de ID: ${usuario.id}`
            );

            return res.status(403).json({
                erro:
                    "Esta conta não está habilitada para participar.",
                acessoBloqueado: true
            });
        }

        const estadoRoleta =
            obterEstadoRoleta();

        // A TELA É DE UMA RODADA ANTIGA?
        if (
            Number(versaoRodada) !==
            estadoRoleta.versao
        ) {

            console.log(
                `🔄 Tela antiga bloqueada. ` +
                `Cliente: ${versaoRodada} | ` +
                `Servidor: ${estadoRoleta.versao}`
            );

            return res.status(409).json({
                erro:
                    "Uma nova rodada foi iniciada.",

                rodadaAtualizada: true,

                versao:
                    estadoRoleta.versao
            });
        }


        // A RODADA JÁ FOI LIBERADA?
        if (!estadoRoleta.aberta) {

            console.log(
                `🔒 Giro bloqueado: rodada ${estadoRoleta.versao} fechada`
            );

            return res.status(423).json({
                erro:
                    "A nova rodada ainda não foi liberada.",

                rodadaFechada: true,

                versao:
                    estadoRoleta.versao
            });
        }


        const versaoDoGiro =
            estadoRoleta.versao;

        // VERIFICA SE ESTÁ NOS CANAIS
        try {

            const canaisFaltando =
                await verificarCanaisObrigatorios(
                    usuario.id
                );

            if (canaisFaltando.length > 0) {

                console.log(
                    `🔒 ${usuario.id} não está em todos os canais`
                );

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
        // CONFIRMA A RODADA NOVAMENTE
        // ========================================

        const estadoConfirmado =
            obterEstadoRoleta();

        if (
            estadoConfirmado.versao !==
            versaoDoGiro
        ) {

            console.log(
                `🔄 Giro antigo cancelado. ` +
                `Começou na rodada ${versaoDoGiro}, ` +
                `mas agora estamos na ${estadoConfirmado.versao}`
            );

            return res.status(409).json({
                erro:
                    "Uma nova rodada foi iniciada.",

                rodadaAtualizada: true,

                versao:
                    estadoConfirmado.versao
            });
        }

        if (!estadoConfirmado.aberta) {

            console.log(
                `🔒 Giro cancelado: rodada ${estadoConfirmado.versao} fechada`
            );

            return res.status(423).json({
                erro:
                    "A nova rodada ainda não foi liberada.",

                rodadaFechada: true,

                versao:
                    estadoConfirmado.versao
            });
        }

        const usuarioId =
            String(usuario.id);


        // ========================================
        // JÁ UTILIZOU O GIRO?
        // ========================================

        const giroAnterior =
            buscarGiroUsuarioCampanha(
                usuarioId,
                CAMPANHA_ATUAL
            );

        if (giroAnterior) {

            console.log(
                `🔒 ${usuarioId} já utilizou o giro`
            );

            return res.status(409).json({
                erro:
                    "Você já utilizou sua rodada.",

                jaGirou: true,

                resultadoAnterior: {
                    indice:
                        giroAnterior.indice,

                    premio:
                        giroAnterior.premio
                }
            });
        }


        // ========================================
        // JÁ SAÍRAM OS 5 GANHADORES?
        // ========================================

        const totalGanhadores =
            contarGanhadoresCampanha(
                CAMPANHA_ATUAL
            );

        if (
            totalGanhadores >=
            MAX_GANHADORES
        ) {

            console.log(
                "🏁 Prêmios esgotados"
            );

            return res.status(410).json({
                erro:
                    "Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀",

                premiosEsgotados: true
            });
        }

        const indice =
            crypto.randomInt(
                0,
                premios.length
            );

        const premio =
            premios[indice];

        const ehPremio =
            PREMIOS_VALIDOS.has(
                premio
            );

        const registro =
            registrarGiroCampanha({
                usuarioId,
                indice,
                premio,

                campanha:
                    CAMPANHA_ATUAL,

                ehPremio,

                maxGanhadores:
                    MAX_GANHADORES
            });

        if (!registro.ok) {

            if (
                registro.motivo ===
                "ja_girou"
            ) {

                return res.status(409).json({
                    erro:
                        "Você já utilizou sua rodada.",

                    jaGirou: true
                });
            }

            if (
                registro.motivo ===
                "esgotado"
            ) {

                return res.status(410).json({
                    erro:
                        "Os prêmios acabaram por enquanto. Talvez a roleta volte em breve 👀",

                    premiosEsgotados: true
                });
            }
        }

        const giroId =
            registro.giroId;

        console.log(
            `✅ Telegram validado: ${usuario.id}`
        );

        console.log(
            `👤 Usuário: ${usuario.first_name}` +
            (
                usuario.username
                    ? ` (@${usuario.username})`
                    : ""
            )
        );

        console.log(
            `💾 Giro ${giroId} salvo`
        );

        console.log(
            `🎡 Resultado: ${premio}`
        );

        if (ehPremio) {

            console.log(
                `🏆 GANHADOR ${registro.totalGanhadores}/${MAX_GANHADORES}`
            );

            setTimeout(() => {

                const estadoAtual =
                    obterEstadoRoleta();

                if (
                    estadoAtual.versao !==
                    versaoDoGiro
                ) {

                    console.log(
                        `⏭️ Aviso antigo ignorado. ` +
                        `Giro da rodada ${versaoDoGiro}, ` +
                        `rodada atual ${estadoAtual.versao}`
                    );

                    return;
                }

                avisarGanhador(
                    usuario,
                    premio
                ).catch((erro) => {

                    console.error(
                        "❌ Erro ao anunciar ganhador:",
                        erro
                    );
                });

            }, 5500);

        }

        res.json({
            giroId,
            indice,
            premio
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