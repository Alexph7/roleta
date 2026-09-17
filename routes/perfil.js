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
                initData,
                usuarioIdAlvo
            } = req.body || {};

            // ========================================
            // VALIDA QUEM ESTÁ CONSULTANDO
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

            // ========================================
            // QUAL PERFIL SERÁ ABERTO
            // SEM usuarioIdAlvo = MEU PERFIL
            // COM usuarioIdAlvo = PERFIL PÚBLICO
            // ========================================
            const meuId =
                String(
                    usuarioTelegram.id
                );
            let idAlvo =
                meuId;
            if (
                usuarioIdAlvo !== undefined &&
                usuarioIdAlvo !== null &&
                String(
                    usuarioIdAlvo
                ).trim() !== ""
            ) {
                idAlvo =
                    String(
                        usuarioIdAlvo
                    ).trim();
            }

            if (
                !/^\d{1,20}$/.test(
                    idAlvo
                )
            ) {
                return res
                    .status(400)
                    .json({
                        erro:
                            "Usuário inválido."
                    });
            }

            try {
                // Atualiza somente os dados
                // de quem está usando o app.
                salvarUsuarioTelegram(
                    usuarioTelegram
                );

                const perfil =
                    obterPerfilUsuario(
                        idAlvo
                    );

                if (!perfil) {
                    return res
                        .status(404)
                        .json({
                            erro:
                                "Perfil não encontrado."
                        });
                }

                const ehMeuPerfil =
                    idAlvo === meuId;

                // Outro jogador só pode ser
                // consultado se estiver no ranking.
                if (
                    !ehMeuPerfil &&
                    !perfil.posicao
                ) {
                    return res
                        .status(404)
                        .json({
                            erro:
                                "Perfil público não encontrado."
                        });
                }

                // ========================================
                // SOMENTE DADOS PÚBLICOS
                // NÃO DEVOLVE ID NEM USERNAME
                // ========================================

                const perfilPublico = {
                    nome:
                        perfil.nome,
                    pontos:
                        perfil.pontos,
                    posicao:
                        perfil.posicao,
                    girosPontos:
                        perfil.girosPontos,
                    mediaPontosPorGiro:
                        perfil.mediaPontosPorGiro,
                    diamantes:
                        perfil.diamantes,
                    bausAbertos:
                        perfil.bausAbertos,
                    girosPremiada:
                        perfil.girosPremiada,
                    criadoEm:
                        perfil.criadoEm
                };

                return res.json({
                    perfil:
                        perfilPublico
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
                            "Não foi possível carregar o perfil agora."
                    });
            }
        }
    );
}

module.exports =
    registrarRotaPerfil;