const jogoTetris = require("../services/jogo-tetris");

const MENSAGENS = {
    partida_inexistente:
        "Essa partida não está mais aberta. Comece uma nova.",
    registro_invalido:
        "Não foi possível validar essa partida, ela não entrou no ranking.",
    campeonato_encerrado:
        "O campeonato terminou. Confira o ranking final abaixo."
};

function registrarRotaTetris(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId,
        salvarUsuarioTelegram
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

    app.post("/api/tetris/estado", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);

            res.set("Cache-Control", "no-store");

            return res.json(jogoTetris.estado(usuario.id));
        } catch (erro) {
            console.error("Erro ao carregar estado do tetris:", erro);

            return res.status(500).json({
                erro: "Não foi possível carregar o jogo."
            });
        }
    });

    app.post("/api/tetris/iniciar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);

            res.set("Cache-Control", "no-store");

            const partida = jogoTetris.iniciar(usuario.id);

            if (!partida.ok) {
                return res.status(409).json({
                    erro:
                        MENSAGENS[partida.motivo] ||
                        "Não foi possível iniciar o jogo."
                });
            }

            return res.json(partida);
        } catch (erro) {
            console.error("Erro ao iniciar tetris:", erro);

            return res.status(500).json({
                erro: "Não foi possível iniciar o jogo."
            });
        }
    });

    app.post("/api/tetris/finalizar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const resultado = jogoTetris.finalizar(
                usuario.id,
                req.body?.partidaId,
                req.body?.pacote
            );

            if (!resultado.ok) {
                return res.status(409).json({
                    erro:
                        MENSAGENS[resultado.motivo] ||
                        "Não foi possível registrar a partida."
                });
            }

            res.set("Cache-Control", "no-store");

            return res.json(resultado);
        } catch (erro) {
            console.error("Erro ao finalizar tetris:", erro);

            return res.status(500).json({
                erro: "Não foi possível registrar a partida."
            });
        }
    });

    app.post("/api/tetris/ranking", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            const lista = jogoTetris.listarRanking(40);

            res.set("Cache-Control", "no-store");

            return res.json({
                ranking: lista.ranking,
                totalJogadores: lista.totalJogadores,
                meu: jogoTetris.resultadoUsuario(usuario.id),
                fimCampeonato: jogoTetris.FIM_CAMPEONATO,
                encerrado: jogoTetris.encerrado()
            });
        } catch (erro) {
            console.error("Erro ao carregar ranking do tetris:", erro);

            return res.status(500).json({
                erro: "Não foi possível carregar o ranking."
            });
        }
    });
}

module.exports = registrarRotaTetris;