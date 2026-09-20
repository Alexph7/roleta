const {
    salvarUsuarioTelegram
} = require(
    "../database"
);


const {
    obterRankingMediaAtiva
} = require(
    "../services/ranking-media-ativa"
);


// ========================================
// ROTA RANKING MÉDIA ATIVA
// ========================================

function registrarRotaRankingMediaAtiva(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
) {
    app.post(
        "/api/ranking-media-ativa",
        (req, res) => {

            const {
                initData
            } = req.body || {};


            const validacao =
                validarInitDataTelegram(
                    initData
                );


            if (!validacao.ok) {

                return res
                    .status(401)
                    .json({
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
                return res
                    .status(403)
                    .json({
                        erro:
                            "Esta conta não está habilitada."
                    });
            }


            try {

                salvarUsuarioTelegram(
                    usuarioTelegram
                );


                const resultado =
                    obterRankingMediaAtiva(
                        usuarioTelegram.id,
                        40
                    );


                return res.json(
                    resultado
                );


            } catch (erro) {

                console.error(
                    "❌ Erro no ranking de média ativa:",
                    erro
                );


                return res
                    .status(500)
                    .json({
                        erro:
                            "Não foi possível carregar o ranking de média ativa agora."
                    });
            }
        }
    );
}


module.exports =
    registrarRotaRankingMediaAtiva;