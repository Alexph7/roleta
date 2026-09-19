const {
    salvarUsuarioTelegram
} = require(
    "../database"
);

const {
    listarNews
} = require(
    "../services/news-service"
);


// ========================================
// ROTA NEWS
// ========================================

function registrarRotaNews(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
) {
    app.post(
        "/api/news",
        (req, res) => {

            const {
                initData
            } = req.body || {};


            const validacao =
                validarInitDataTelegram(
                    initData
                );


            if (
                !validacao.ok
            ) {
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


                res.set(
                    "Cache-Control",
                    "no-store"
                );


                return res.json({
                    noticias:
                        listarNews(
                            150
                        )
                });

            } catch (erro) {

                console.error(
                    "❌ Erro ao carregar News:",
                    erro
                );


                return res
                    .status(500)
                    .json({
                        erro:
                            "Não foi possível carregar as notícias agora."
                    });
            }
        }
    );
}


module.exports =
    registrarRotaNews;