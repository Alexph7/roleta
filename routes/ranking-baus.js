const {
    salvarUsuarioTelegram
} = require(
    "../database"
);

const {
    obterRankingBaus
} = require(
    "../services/ranking-baus"
);

// ========================================
// ROTA RANKING DE BAÚS
// ========================================
function registrarRotaRankingBaus(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
) {
    app.post(
        "/api/ranking-baus",
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
                    obterRankingBaus(
                        usuarioTelegram.id,
                        40
                    );

                return res.json(
                    resultado
                );

            } catch (erro) {

                console.error(
                    "❌ Erro no ranking de baús:",
                    erro
                );

                return res
                    .status(500)
                    .json({
                        erro:
                            "Não foi possível carregar o ranking de baús agora."
                    });
            }
        }
    );
}

module.exports =
    registrarRotaRankingBaus;