const {
    salvarUsuarioTelegram
} = require(
    "../database"
);


const {
    obterPerfilUsuario
} = require(
    "../services/perfil-service"
);


// ========================================
// ROTA DO PERFIL
// ========================================

function registrarRotaPerfil(
    app,
    {
        validarInitDataTelegram,
        usuarioLiberadoPorId
    }
) {

    app.post(
        "/api/perfil",
        (req, res) => {

            const {
                initData
            } = req.body || {};


            // ========================================
            // VALIDA TELEGRAM
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
            // MESMA REGRA DE ACESSO DO APP
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

                // Atualiza nome / username
                // antes de montar o perfil.

                salvarUsuarioTelegram(
                    usuarioTelegram
                );


                const perfil =
                    obterPerfilUsuario(
                        usuarioTelegram.id
                    );


                if (!perfil) {

                    return res
                        .status(404)
                        .json({
                            erro:
                                "Perfil não encontrado."
                        });
                }


                return res.json({
                    perfil
                });


            } catch (erro) {

                console.error(
                    "❌ Erro ao carregar perfil:",
                    erro
                );


                return res
                    .status(500)
                    .json({
                        erro:
                            "Não foi possível carregar seu perfil agora."
                    });
            }
        }
    );
}


module.exports =
    registrarRotaPerfil;