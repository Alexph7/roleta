const {
    salvarUsuarioTelegram
} = require(
    "../database"
);


const {
    obterEstado100x100,
    iniciarPartida100x100,
    escolherQuadrado100x100,
    resgatar100x100
} = require(
    "../services/100x100-service"
);


module.exports =
    function registrarRota100x100(
        app,
        {
            validarInitDataTelegram,
            usuarioLiberadoPorId
        }
    ) {


        function autenticar(
            req,
            res
        ) {

            const validacao =
                validarInitDataTelegram(
                    req.body?.initData
                );


            if (
                !validacao.ok
            ) {

                res.status(
                    401
                ).json({
                    erro:
                        "Abra pelo Telegram."
                });

                return null;
            }


            const usuario =
                validacao.usuario;


            if (
                !usuarioLiberadoPorId(
                    usuario.id
                )
            ) {

                res.status(
                    403
                ).json({

                    erro:
                        "Esta conta não está habilitada.",

                    acessoBloqueado:
                        true
                });

                return null;
            }


            salvarUsuarioTelegram(
                usuario
            );


            return usuario;
        }


        function erroJogo(
            res,
            resultado
        ) {

            const motivo =
                resultado?.motivo ||
                "erro";


            const estado =
                resultado?.estado ||
                null;


            if (
                motivo ===
                "saldo_insuficiente"
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        erro:
                            `Você precisa de ${Number(
                                resultado.custo ||
                                0
                            ).toLocaleString(
                                "pt-BR"
                            )} pontos para jogar.`,

                        motivo,

                        estado
                    });
            }


            if (
                motivo ===
                "limite_diario"
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        erro:
                            "Você já usou as 3 partidas deste período.",

                        motivo,

                        estado
                    });
            }


            if (
                motivo ===
                "partida_ativa"
            ) {

                return res
                    .status(
                        409
                    )
                    .json({

                        erro:
                            "Você já tem uma partida em andamento.",

                        motivo,

                        estado
                    });
            }


            if (
                motivo ===
                "sem_partida_ativa"
            ) {

                return res
                    .status(
                        409
                    )
                    .json({

                        erro:
                            "Não há uma partida em andamento.",

                        motivo,

                        estado
                    });
            }


            if (
                motivo ===
                "sem_premio_para_resgatar"
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        erro:
                            "Acerte uma linha antes de resgatar.",

                        motivo,

                        estado
                    });
            }


            if (
                motivo ===
                "lado_invalido"
            ) {

                return res
                    .status(
                        400
                    )
                    .json({

                        erro:
                            "Escolha inválida.",

                        motivo
                    });
            }


            return res
                .status(
                    500
                )
                .json({

                    erro:
                        "Não foi possível processar o 100x100 agora.",

                    motivo
                });
        }


        function executar(
            req,
            res,
            acao,
            mensagemErro
        ) {

            const usuario =
                autenticar(
                    req,
                    res
                );


            if (
                !usuario
            ) {

                return;
            }


            try {

                const resultado =
                    acao(
                        usuario
                    );


                if (
                    !resultado.ok
                ) {

                    return erroJogo(
                        res,
                        resultado
                    );
                }


                res.set(
                    "Cache-Control",
                    "no-store"
                );


                return res.json(
                    resultado
                );


            } catch (
            erro
            ) {

                console.error(
                    mensagemErro,
                    erro
                );


                return res
                    .status(
                        500
                    )
                    .json({

                        erro:
                            "Não foi possível processar o 100x100 agora."
                    });
            }
        }


        // ========================================
        // ESTADO
        // ========================================

        app.post(
            "/api/100x100/estado",

            (
                req,
                res
            ) => {

                executar(

                    req,

                    res,

                    usuario =>
                        obterEstado100x100(
                            usuario.id
                        ),

                    "❌ Erro ao carregar 100x100:"
                );
            }
        );


        // ========================================
        // INICIAR
        // ========================================

        app.post(
            "/api/100x100/iniciar",

            (
                req,
                res
            ) => {

                executar(

                    req,

                    res,

                    usuario =>
                        iniciarPartida100x100(
                            usuario.id
                        ),

                    "❌ Erro ao iniciar 100x100:"
                );
            }
        );


        // ========================================
        // ESCOLHER
        // ========================================

        app.post(
            "/api/100x100/escolher",

            (
                req,
                res
            ) => {

                executar(

                    req,

                    res,

                    usuario =>
                        escolherQuadrado100x100(
                            usuario.id,
                            req.body?.lado
                        ),

                    "❌ Erro na escolha do 100x100:"
                );
            }
        );


        // ========================================
        // RESGATAR
        // ========================================

        app.post(
            "/api/100x100/resgatar",

            (
                req,
                res
            ) => {

                executar(

                    req,

                    res,

                    usuario =>
                        resgatar100x100(
                            usuario.id
                        ),

                    "❌ Erro ao resgatar 100x100:"
                );
            }
        );
    };