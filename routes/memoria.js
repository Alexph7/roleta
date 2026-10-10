const jogoMemoria = require("../services/jogo-memoria");

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
                erro: "Esta conta nÃ£o estÃ¡ habilitada.",
                acessoBloqueado: true
            });
            return null;
        }

        return usuario;
    }

    app.post("/api/memoria/iniciar", (req, res) => {
        const usuario = obterUsuario(req, res);
        if (!usuario) return;

        try {
            salvarUsuarioTelegram(usuario);
            return res.json(
                jogoMemoria.iniciar(usuario.id)
            );
        } catch (erro) {
            console.error(
                "âŒ Erro ao iniciar memÃ³ria:",
                erro
            );

            return res.status(500).json({
                erro: "NÃ£o foi possÃ­vel iniciar o jogo."
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
                    erro: resultado.motivo
                });
            }

            if (resultado.premioGanho) {
                avisarGanhador(
                    usuario,
                    resultado.premio,
                    "Jogo da MemÃ³ria"
                ).catch(erro => {
                    console.error(
                        "âŒ Erro ao anunciar ganhador da memÃ³ria:",
                        erro
                    );
                });
            }

            return res.json(resultado);
        } catch (erro) {
            console.error(
                "âŒ Erro na jogada da memÃ³ria:",
                erro
            );

            return res.status(500).json({
                erro: "NÃ£o foi possÃ­vel registrar essa jogada."
            });
        }
    });
}

module.exports = registrarRotaMemoria;