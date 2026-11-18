const duelo = require("../services/jogo-memoria-duelo");
const solo = require("../services/jogo-memoria-solo");

const MENSAGENS = {
    aguarde: "Espere um pouco para convidar de novo.",
    em_partida: "Você já está em um duelo.",
    partida_inexistente: "Partida não encontrada. Toque em jogar de novo.",
    ja_entraram:
        "Alguém já entrou, mas você pode começar um jogo sozinho ou convidar alguém também.",
    expirado:
        "Este convite expirou, mas você pode começar um jogo sozinho ou convidar alguém também.",
    nao_participa: "Você não está nesta partida.",
    partida_encerrada: "A partida já terminou.",
    nao_e_sua_vez: "Ainda não é a sua vez.",
    aguarde_vez: "Espere a sua vez começar.",
    indice_invalido: "Carta inválida.",
    carta_ja_encontrada: "Essa carta já foi encontrada.",
    mesma_carta: "Escolha outra carta."
};

function registrarRotaMemoriaDuelo(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId,
        salvarUsuarioTelegram,
        enviarConvite,
        apagarMensagem
    }
) {
    const MINI_APP_LINK = (process.env.MINI_APP_LINK || "").trim();

    function obterUsuario(req, res) {
        const validacao = validarInitDataTelegram(req.body?.initData);

        if (!validacao.ok) {
            res.status(401).json({ erro: "Abra pelo Telegram." });
            return null;
        }

        const usuario = validacao.usuario;

        if (!usuarioLiberadoPorId(usuario.id)) {
            res.status(403).json({
                erro: "Esta conta não está habilitada.",
                acessoBloqueado: true
            });
            return null;
        }

        return usuario;
    }

    function responderErro(res, resultado, padrao) {
        return res.status(409).json({
            erro: MENSAGENS[resultado.motivo] || padrao,
            motivo: resultado.motivo,
            esperarMs: resultado.esperarMs,
            codigo: resultado.codigo
        });
    }

    async function apagarConviteAgora(partidaId, chatId, mensagemId) {
        try {
            await apagarMensagem(chatId, mensagemId);
            duelo.marcarMensagemApagada(partidaId, true);
        } catch (erro) {
            console.error("Erro ao apagar convite do duelo:", erro?.message || erro);
            duelo.marcarMensagemApagada(partidaId, false);
        }
    }

    // ---------- CONVIDAR ----------

    app.post("/api/memoria-duelo/convidar", async (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        if (!MINI_APP_LINK) {
            return res.status(503).json({
                erro: "Convites ainda não estão disponíveis."
            });
        }

        let resultado;

        try {
            const usuarioApp = salvarUsuarioTelegram(usuario);
            resultado = duelo.criar(usuario.id);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Não foi possível convidar.");
            }

            const link =
                `${MINI_APP_LINK}?startapp=duelo_${resultado.codigo}`;

            const minutos = Math.round(duelo.CONVITE_EXPIRA_MS / 60000);

            const texto =
                `🧠 ${usuarioApp.nome} está convidando alguém para um ` +
                `duelo no Jogo da Memória!\n\n` +
                `O primeiro que entrar joga. ` +
                `Este convite some em ${minutos} minutos.`;

            const mensagem = await enviarConvite(texto, link);

            duelo.salvarMensagem(
                resultado.id,
                mensagem.chat.id,
                mensagem.message_id
            );

            console.log(
                `🧠 DUELO CRIADO | ${resultado.codigo} | ${usuario.id}`
            );

            res.set("Cache-Control", "no-store");

            const { id, ...publico } = resultado;
            return res.json(publico);

        } catch (erro) {
            console.error("Erro ao criar duelo da memória:", erro);

            if (resultado?.ok) {
                duelo.cancelarPorFalha(resultado.id);
            }

            return res.status(500).json({
                erro: "Não foi possível enviar o convite agora."
            });
        }
    });

    // ---------- CANCELAR (quem convidou desistiu) ----------

    app.post("/api/memoria-duelo/cancelar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = duelo.cancelar(usuario.id, req.body?.codigo);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Não foi possível cancelar.");
            }

            verificar(); // apaga a mensagem já, sem esperar a varredura

            return res.json({ ok: true });

        } catch (erro) {
            console.error("Erro ao cancelar duelo:", erro);
            return res.status(500).json({ erro: "Não foi possível cancelar." });
        }
    });

    // ---------- DESISTIR (VOLTAR ou app fechado) ----------

    app.post("/api/memoria-duelo/desistir", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = duelo.desistir(usuario.id, req.body?.codigo);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Não foi possível sair.");
            }

            verificar(); // apaga o convite do chat, se ainda estiver lá

            return res.json({ ok: true });

        } catch (erro) {
            console.error("Erro ao desistir:", erro);
            return res.status(500).json({ erro: "Não foi possível sair." });
        }
    });

    // ---------- ENTRAR ----------

    app.post("/api/memoria-duelo/entrar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);

            const resultado = duelo.entrar(usuario.id, req.body?.codigo);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Não foi possível entrar.");
            }

            console.log(
                `🧠 DUELO COMEÇOU | ${resultado.codigo} | entrou ${usuario.id}`
            );

            verificar(); // apaga o convite do chat na hora

            res.set("Cache-Control", "no-store");

            const { id, ...publico } = resultado;
            return res.json(publico);

        } catch (erro) {
            console.error("Erro ao entrar no duelo:", erro);
            return res.status(500).json({ erro: "Não foi possível entrar." });
        }
    });

    // ---------- ESTADO ----------

    app.post("/api/memoria-duelo/estado", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = duelo.estado(usuario.id, req.body?.codigo);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Partida não encontrada.");
            }

            res.set("Cache-Control", "no-store");
            return res.json(resultado);

        } catch (erro) {
            console.error("Erro no estado do duelo:", erro);
            return res.status(500).json({ erro: "Não foi possível atualizar." });
        }
    });

    // ---------- JOGADA ----------

    app.post("/api/memoria-duelo/jogada", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = duelo.jogar(
                usuario.id,
                req.body?.codigo,
                req.body?.indice
            );

            if (!resultado.ok) {
                return responderErro(res, resultado, "Jogada inválida.");
            }

            res.set("Cache-Control", "no-store");
            return res.json(resultado);

        } catch (erro) {
            console.error("Erro na jogada do duelo:", erro);
            return res.status(500).json({
                erro: "Não foi possível registrar essa jogada."
            });
        }
    });

    // ---------- RANKING DE DUELOS ----------

    app.post("/api/memoria-duelo/ranking", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            res.set("Cache-Control", "no-store");
            return res.json({ ranking: duelo.listarRanking(50) });

        } catch (erro) {
            console.error("Erro no ranking de duelos:", erro);
            return res.status(500).json({
                erro: "Não foi possível carregar o ranking."
            });
        }
    });

    // ==============================
    // MODO SOLO (conferido pelo servidor)
    // ==============================

    app.post("/api/memoria-solo/iniciar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);
            res.set("Cache-Control", "no-store");
            return res.json(solo.iniciar(usuario.id));

        } catch (erro) {
            console.error("Erro ao iniciar memória solo:", erro);
            return res.status(500).json({ erro: "Não foi possível começar." });
        }
    });

    app.post("/api/memoria-solo/jogada", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = solo.jogar(usuario.id, req.body?.indice);

            if (!resultado.ok) {
                return responderErro(res, resultado, "Jogada inválida.");
            }

            res.set("Cache-Control", "no-store");
            return res.json(resultado);

        } catch (erro) {
            console.error("Erro na jogada da memória solo:", erro);
            return res.status(500).json({
                erro: "Não foi possível registrar essa jogada."
            });
        }
    });

    app.post("/api/memoria-solo/ranking", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            res.set("Cache-Control", "no-store");
            return res.json({
                ranking: solo.listarRanking(50),
                meu: solo.resultadoUsuario(usuario.id)
            });

        } catch (erro) {
            console.error("Erro no ranking solo:", erro);
            return res.status(500).json({
                erro: "Não foi possível carregar o ranking."
            });
        }
    });

    // ==============================
    // VARREDURA: fecha partidas paradas e
    // apaga convites aceitos, cancelados ou vencidos
    // ==============================

    let varrendo = false;

    async function verificar() {
        if (varrendo) return;
        varrendo = true;

        try {
            const paraApagar = duelo.varrer();

            for (const item of paraApagar) {
                await apagarConviteAgora(item.id, item.msg_chat_id, item.msg_id);
            }
        } catch (erro) {
            console.error("Erro na varredura dos duelos:", erro);
        } finally {
            varrendo = false;
        }
    }

    verificar();
    setInterval(verificar, 10 * 1000);
}

module.exports = registrarRotaMemoriaDuelo;
