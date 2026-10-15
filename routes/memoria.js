const jogoMemoria = require("../services/jogo-memoria");

const MENSAGENS = {
    encerrado: "O Jogo da Memória terminou.",
    partida_inexistente: "Comece uma partida primeiro.",
    indice_invalido: "Carta inválida.",
    carta_ja_encontrada: "Essa carta já foi encontrada.",
    mesma_carta: "Escolha outra carta."
};

function registrarRotaMemoria(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId,
        salvarUsuarioTelegram,
        avisarGanhador
    }
) {
    function obterUsuario(req, res) {
        const validacao = validarInitDataTelegram(
            req.body?.initData
        );

        if (!validacao.ok) {
            res.status(401).json({
                erro: "Abra pelo Telegram."
            });
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

    // Estado antes de começar (regras, próxima partida).
    app.post("/api/memoria/estado", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);

            res.set("Cache-Control", "no-store");

            return res.json(
                jogoMemoria.estado(usuario.id)
            );
        } catch (erro) {
            console.error(
                "Erro ao carregar estado da memória:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível carregar o jogo."
            });
        }
    });

    app.post("/api/memoria/iniciar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);

            const resultado = jogoMemoria.iniciar(usuario.id);

            if (!resultado.ok) {
                return res.status(409).json({
                    erro:
                        MENSAGENS[resultado.motivo] ||
                        "Não foi possível iniciar o jogo.",
                    encerrado: resultado.motivo === "encerrado"
                });
            }

            res.set("Cache-Control", "no-store");

            return res.json(resultado);
        } catch (erro) {
            console.error(
                "Erro ao iniciar memória:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível iniciar o jogo."
            });
        }
    });

    app.post("/api/memoria/jogada", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = jogoMemoria.jogar(
                usuario.id,
                req.body?.indice
            );

            if (!resultado.ok) {
                return res.status(409).json({
                    erro:
                        MENSAGENS[resultado.motivo] ||
                        "Jogada inválida.",
                    encerrado: resultado.motivo === "encerrado"
                });
            }

            res.set("Cache-Control", "no-store");

            return res.json(resultado);
        } catch (erro) {
            console.error(
                "Erro na jogada:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível registrar essa jogada."
            });
        }
    });

    // Ranking do jogo (atualizado a cada partida concluída).
    app.post("/api/memoria/ranking", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const lista = jogoMemoria.listarRanking(50);

            res.set("Cache-Control", "no-store");

            return res.json({
                ranking: lista.ranking,
                totalConcluidos: lista.totalConcluidos,
                meu: jogoMemoria.resultadoUsuario(usuario.id),
                encerrado: Date.now() >= jogoMemoria.FIM_EM,
                fimEm: jogoMemoria.FIM_EM,
                premio: jogoMemoria.PREMIO,
                qtdPremiados: jogoMemoria.QTD_PREMIADOS
            });
        } catch (erro) {
            console.error(
                "Erro ao carregar ranking da memória:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível carregar o ranking."
            });
        }
    });

    // ==============================
    // PREMIAÇÃO APÓS O FIM
    // ==============================

    async function verificarPremiacao() {
        try {
            const premiados = jogoMemoria.premiarSeEncerrado();

            for (const item of premiados) {
                await avisarGanhador(
                    {
                        id: item.usuario_id,
                        first_name: item.first_name,
                        username: item.username
                    },
                    `${item.premio} (${item.posicao}º lugar)`,
                    "Jogo da Memória"
                );
            }
        } catch (erro) {
            console.error(
                "Erro ao premiar jogo da memória:",
                erro
            );
        }
    }

    verificarPremiacao();
    setInterval(verificarPremiacao, 30 * 1000);
}

module.exports = registrarRotaMemoria;