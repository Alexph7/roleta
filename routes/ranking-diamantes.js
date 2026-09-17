const {
    salvarUsuarioTelegram
} = require(
    "../database"
);


const {
    obterRankingDiamantes
} = require(
    "../services/ranking-diamantes"
);


// ========================================
// ROTA RANKING DE DIAMANTES
// ========================================

function registrarRotaRankingDiamantes(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
) {
    app.post(
        "/api/ranking-diamantes",
        (req, res) => {

            const {
                initData
            } = req.body || {};


            // ========================================
            // TELEGRAM
            // ========================================

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


            // ========================================
            // ACESSO
            // ========================================

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
                    obterRankingDiamantes(
                        usuarioTelegram.id,
                        30
                    );


                return res.json(
                    resultado
                );

            } catch (erro) {

                console.error(
                    "❌ Erro no ranking de diamantes:",
                    erro
                );


                return res
                    .status(500)
                    .json({
                        erro:
                            "Não foi possível carregar o ranking de diamantes agora."
                    });
            }
        }
    );
}


module.exports =
    registrarRotaRankingDiamantes;